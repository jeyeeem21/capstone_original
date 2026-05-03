<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7f0518; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .code-box { background: white; border: 2px dashed #7f0518; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .code { font-size: 32px; font-weight: bold; color: #7f0518; letter-spacing: 8px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Verify Your New Email</h2>
        </div>
        <div class="content">
            <p>Hello <strong>{{ $userName }}</strong>,</p>
            <p>You requested to change your email address to <strong>{{ $newEmail }}</strong>.</p>
            <p>Please use the verification code below to complete the process:</p>
            
            <div class="code-box">
                <div class="code">{{ $code }}</div>
            </div>
            
            <p><strong>This code will expire in 15 minutes.</strong></p>
            <p>If you did not request this change, please ignore this email and contact your administrator.</p>
        </div>
        <div class="footer">
            <p>This is an automated message from {{ \App\Models\BusinessSetting::getValue('business_name', config('app.name')) }} Management System.</p>
        </div>
    </div>
</body>
</html>
