<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7f0518; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Email Address Changed</h2>
        </div>
        <div class="content">
            <p>Hello <strong>{{ $userName }}</strong>,</p>
            
            <div class="alert">
                <h3>Your email address has been changed</h3>
                <p><strong>Old Email:</strong> {{ $oldEmail }}</p>
                <p><strong>New Email:</strong> {{ $newEmail }}</p>
            </div>
            
            <p><strong>IP Address:</strong> {{ $ipAddress }}</p>
            <p><strong>Time:</strong> {{ now()->format('F j, Y g:i A') }}</p>
            
            <p><strong>Important:</strong> If you did not make this change, please contact your administrator immediately. Your account may be compromised.</p>
        </div>
        <div class="footer">
            <p>This notification was sent to your old email address for security purposes.</p>
            <p>{{ \App\Models\BusinessSetting::getValue('business_name', config('app.name')) }} Management System</p>
        </div>
    </div>
</body>
</html>
