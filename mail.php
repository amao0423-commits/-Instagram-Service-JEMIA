<?php
declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => '不正なリクエストです。'], JSON_UNESCAPED_UNICODE);
    exit;
}

// スパム対策（非表示フィールドに入力があれば送信しない）
if (!empty($_POST['website'] ?? '')) {
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

$defaults = [
    'admin_to' => 'amao0423@hotseller.co.kr',
    'from_email' => 'amao0423@hotseller.co.kr',
    'from_name' => 'JEMIA',
    'admin_subject' => '【JEMIA】新規お問い合わせ/診断申し込みがありました',
    'user_subject' => '【JEMIA】お問い合わせありがとうございます',
    'rate_limit_max' => 6,
    'rate_limit_window_seconds' => 600,
];

$config = $defaults;
$configPath = __DIR__ . DIRECTORY_SEPARATOR . 'mail-config.php';
if (is_file($configPath)) {
    $loaded = require $configPath;
    if (is_array($loaded)) {
        $config = array_merge($defaults, $loaded);
    }
}

function jemia_sanitize_line(string $s): string
{
    return trim(str_replace(["\r", "\n"], '', $s));
}

$name = jemia_sanitize_line((string) ($_POST['name'] ?? ''));
$email = trim((string) ($_POST['email'] ?? ''));
$entity = jemia_sanitize_line((string) ($_POST['entity'] ?? ''));
$company = jemia_sanitize_line((string) ($_POST['company'] ?? ''));
$industry = jemia_sanitize_line((string) ($_POST['industry'] ?? ''));
$inquiry_type = jemia_sanitize_line((string) ($_POST['inquiry_type'] ?? ''));
$instagram_id = jemia_sanitize_line((string) ($_POST['instagram_id'] ?? ''));
$message = trim((string) ($_POST['message'] ?? ''));

$productRaw = $_POST['product_interest'] ?? null;
$productLines = [];
if (is_array($productRaw)) {
    foreach ($productRaw as $p) {
        $productLines[] = jemia_sanitize_line((string) $p);
    }
    $productLines = array_values(array_filter($productLines, static fn ($x) => $x !== ''));
}

if ($name === '' || $email === '' || $industry === '' || $message === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => '必須項目をご入力ください。'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($entity === 'corporate' && $company === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => '法人の場合は会社名をご入力ください。'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'メールアドレスの形式が正しくありません。'], JSON_UNESCAPED_UNICODE);
    exit;
}

$rateMax = (int) ($config['rate_limit_max'] ?? 0);
$rateWindow = (int) ($config['rate_limit_window_seconds'] ?? 600);
if ($rateMax > 0 && $rateWindow > 0) {
    $now = time();
    if (!isset($_SESSION['jemia_rl']) || !is_array($_SESSION['jemia_rl'])) {
        $_SESSION['jemia_rl'] = [];
    }
    $_SESSION['jemia_rl'] = array_values(array_filter(
        $_SESSION['jemia_rl'],
        static function ($t) use ($now, $rateWindow) {
            return is_int($t) && $t > $now - $rateWindow;
        }
    ));
    if (count($_SESSION['jemia_rl']) >= $rateMax) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'error' => 'しばらく時間をおいてから再度お試しください。'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

$adminTo = (string) $config['admin_to'];
$fromAddr = (string) $config['from_email'];
$fromName = (string) $config['from_name'];
$adminSubject = (string) $config['admin_subject'];
$userSubject = (string) $config['user_subject'];
$fromHeader = $fromName . ' <' . $fromAddr . '>';

if (function_exists('mb_language')) {
    mb_language('Japanese');
}
if (function_exists('mb_internal_encoding')) {
    mb_internal_encoding('UTF-8');
}

$encSubj = static function (string $s): string {
    if (function_exists('mb_encode_mimeheader')) {
        return mb_encode_mimeheader($s, 'UTF-8');
    }
    return $s;
};

$adminBody = "お問い合わせフォームより送信がありました。\n\n";
$adminBody .= "お名前: {$name}\n";
$adminBody .= "メール: {$email}\n";
$adminBody .= "種別: {$entity}\n";
if ($entity === 'corporate') {
    $adminBody .= "会社名: {$company}\n";
}
$adminBody .= "業種: {$industry}\n";
$adminBody .= "問い合わせ種別: {$inquiry_type}\n";
if ($productLines !== []) {
    $adminBody .= "興味のある商品: " . implode('、', $productLines) . "\n";
}
$adminBody .= "Instagram ID: {$instagram_id}\n";
$adminBody .= "\n--- ご質問・その他 ---\n{$message}\n";

$userBody = "{$name} 様\n\n";
$userBody .= "この度は、JEMIAへお問い合わせいただき、誠にありがとうございます。\n";
$userBody .= "仮のお申し込み・お問い合わせを受け付けました。\n";
$userBody .= "内容を確認のうえ、担当者より1〜2営業日以内にメールにてご連絡いたします。\n";
$userBody .= "今しばらくお待ちくださいますようお願い申し上げます。\n\n";
$userBody .= "━━━━━━━━━━━━━━━━\n";
$userBody .= "株式会社ホットセラー JEMIA\n";

$commonHeaders = 'From: ' . $fromHeader . "\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit";

$adminHeaders = $commonHeaders . "\r\nReply-To: {$email}";

$userHeaders = $commonHeaders;

$send = function (string $to, string $subj, string $body, string $headers) use ($encSubj): bool {
    $encoded = $encSubj($subj);
    if (function_exists('mb_send_mail')) {
        return mb_send_mail($to, $encoded, $body, $headers);
    }
    return mail($to, $encoded, $body, $headers);
};

if (!$send($adminTo, $adminSubject, $adminBody, $adminHeaders)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => '送信に失敗しました。しばらくしてから再度お試しください。'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!$send($email, $userSubject, $userBody, $userHeaders)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => '送信に失敗しました。しばらくしてから再度お試しください。'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($rateMax > 0 && $rateWindow > 0) {
    $_SESSION['jemia_rl'][] = time();
}

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
