<?php
// api.php - Main API endpoint

// Include configuration
require_once 'config.php';

// Set security headers
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: https://yourdomain.com");
header("Access-Control-Allow-Methods: GET");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");

// Validate and sanitize category input
$category = isset($_GET['category']) ? trim($_GET['category']) : null;

if (!$category) {
    http_response_code(400);
    echo json_encode(["error" => "Category parameter is required"]);
    exit;
}

// Validate category format
if (!preg_match(CATEGORY_PATTERN, $category)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid category format"]);
    exit;
}

// Rate limiting
session_start();
$currentTime = time();
if (isset($_SESSION['last_request_time'])) {
    $timeSinceLastRequest = $currentTime - $_SESSION['last_request_time'];
    if ($timeSinceLastRequest < REQUEST_RATE_LIMIT) {
        http_response_code(429);
        echo json_encode(["error" => "Too many requests. Please wait a moment."]);
        exit;
    }
}
$_SESSION['last_request_time'] = $currentTime;

try {
    // Create PDO connection with port specification
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::ATTR_PERSISTENT         => false,
    ];
    
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    
    // Count available entries
    $countStmt = $pdo->prepare("SELECT COUNT(*) as total FROM knowledge_entries WHERE category = :category");
    $countStmt->execute([':category' => $category]);
    $countResult = $countStmt->fetch();
    
    if ($countResult['total'] == 0) {
        http_response_code(404);
        echo json_encode(["error" => "No entries found for the specified category"]);
        exit;
    }
    
    // Get random entry using offset method
    $offset = mt_rand(0, $countResult['total'] - 1);
    
    $stmt = $pdo->prepare("
        SELECT id, summary, category 
        FROM knowledge_entries 
        WHERE category = :category 
        LIMIT 1 OFFSET :offset
    ");
    
    $stmt->bindValue(':category', $category, PDO::PARAM_STR);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    
    $result = $stmt->fetch();
    
    if ($result) {
        // Sanitize output
        $result = array_map('htmlspecialchars', $result);
        echo json_encode($result);
    } else {
        http_response_code(404);
        echo json_encode(["error" => "No entry found"]);
    }
    
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "Service temporarily unavailable"]);
} catch (Exception $e) {
    error_log("Application error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "An unexpected error occurred"]);
}
?>