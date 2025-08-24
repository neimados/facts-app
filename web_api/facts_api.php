<?php
// Secure API for retrieving random knowledge entries by category
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: https://yourdomain.com"); // Restrict to your domain
header("Access-Control-Allow-Methods: GET");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");

// Database configuration - use environment variables in production
$host = getenv('DB_HOST', true) ?: 'localhost';
$dbname = getenv('DB_NAME', true) ?: 'your_database';
$username = getenv('DB_USER', true) ?: 'your_username';
$password = getenv('DB_PASS', true) ?: 'your_password';
$charset = 'utf8mb4';

// Validate and sanitize category input
$category = isset($_GET['category']) ? trim($_GET['category']) : null;

if (!$category) {
    http_response_code(400);
    echo json_encode(["error" => "Category parameter is required"]);
    exit;
}

// Validate category format (alphanumeric, spaces, hyphens, underscores, 1-50 chars)
if (!preg_match('/^[a-zA-Z0-9\s\-_]{1,50}$/', $category)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid category format"]);
    exit;
}

// Limit request rate (simple implementation)
session_start();
$currentTime = time();
if (isset($_SESSION['last_request_time'])) {
    $timeSinceLastRequest = $currentTime - $_SESSION['last_request_time'];
    if ($timeSinceLastRequest < 1) { // At most 1 request per second
        http_response_code(429);
        echo json_encode(["error" => "Too many requests. Please wait a moment."]);
        exit;
    }
}
$_SESSION['last_request_time'] = $currentTime;

try {
    // Create PDO connection with error handling
    $dsn = "mysql:host=$host;dbname=$dbname;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::ATTR_PERSISTENT         => false,
    ];
    
    $pdo = new PDO($dsn, $username, $password, $options);
    
    // First, count available entries for this category
    $countStmt = $pdo->prepare("SELECT COUNT(*) as total FROM knowledge_entries WHERE category = :category");
    $countStmt->execute([':category' => $category]);
    $countResult = $countStmt->fetch();
    
    if ($countResult['total'] == 0) {
        http_response_code(404);
        echo json_encode(["error" => "No entries found for the specified category"]);
        exit;
    }
    
    // Get random entry using a secure method that works with large tables
    // Method: Generate a random offset (more efficient than ORDER BY RAND() for large tables)
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
        // Fallback if offset calculation fails
        http_response_code(404);
        echo json_encode(["error" => "No entry found"]);
    }
    
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage()); // Log error for admin
    http_response_code(500);
    echo json_encode(["error" => "Service temporarily unavailable"]);
} catch (Exception $e) {
    error_log("Application error: " . $e->getMessage()); // Log error for admin
    http_response_code(500);
    echo json_encode(["error" => "An unexpected error occurred"]);
}
?>