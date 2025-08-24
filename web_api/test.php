<?php
// test_connection.php
require_once 'config.php';

try {
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    echo "Connected successfully to MySQL on port " . DB_PORT;
} catch (PDOException $e) {
    echo "Connection failed: " . $e->getMessage();
}
?>