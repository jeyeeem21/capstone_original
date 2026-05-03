<?php

namespace App\Services;

use App\Mail\AdminAlert;
use App\Mail\CustomerLoginNotification;
use App\Mail\DailyUnpaidOrdersReport;
use App\Mail\DeliveryAssigned;
use App\Mail\DeliveryAssignmentNotification;
use App\Mail\LoginNotification;
use App\Mail\NewOrderNotification;
use App\Mail\OrderPlacedCustomer;
use App\Mail\OrderStatusUpdate;
use App\Mail\ProcurementAdminNotification;
use App\Mail\ProcurementNotification;
use App\Mail\VerificationCode;
use App\Mail\WelcomeAccount;
use App\Jobs\SendEmail;
use App\Models\BusinessSetting;
use App\Models\DeliveryAssignment;
use App\Models\Procurement;
use App\Models\Sale;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EmailService
{
    /**
     * Configure the SMTP mailer dynamically from database settings.
     * Uses business_email as SMTP username and Gmail defaults.
     */
    private function configureMailer(): void
    {
        $username = BusinessSetting::getValue('business_email', config('mail.mailers.smtp.username'));
        $password = BusinessSetting::getValue('smtp_password', config('mail.mailers.smtp.password'));

        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => 'smtp.gmail.com',
            'mail.mailers.smtp.port' => 587,
            'mail.mailers.smtp.username' => $username,
            'mail.mailers.smtp.password' => $password,
            'mail.mailers.smtp.encryption' => 'tls',
        ]);

        // Purge the cached mailer so Laravel rebuilds it with new config
        Mail::purge('smtp');
    }

    /**
     * Get the business name from settings.
     */
    private function getBusinessName(): string
    {
        return BusinessSetting::getValue('business_name', config('app.name'));
    }

    /**
     * Get the business email (super admin or business setting).
     */
    private function getAdminEmail(): ?string
    {
        // First try business email from settings
        $businessEmail = BusinessSetting::getValue('business_email');
        if ($businessEmail) {
            return $businessEmail;
        }

        // Fallback to super admin email
        $superAdmin = User::where('role', User::ROLE_SUPER_ADMIN)
            ->where('status', 'active')
            ->first();

        return $superAdmin?->email;
    }

    /**
     * Send email safely — never throw, just log on failure.
     * Dynamically configures SMTP + from address/name from database.
     */
    private function sendSafely(string $to, $mailable): void
    {
        // Save to DB queue + spawn background worker — zero blocking
        SendEmail::dispatchAndProcess($to, $mailable);
    }

    /**
     * Email admin when a new order is placed.
     */
    public function sendNewOrderToAdmin(Sale $sale): void
    {
        $adminEmail = $this->getAdminEmail();
        if (!$adminEmail) return;

        $sale->load('customer');
        $this->sendSafely($adminEmail, new NewOrderNotification($sale));
    }

    /**
     * Email customer when their order is placed.
     */
    public function sendOrderPlacedToCustomer(Sale $sale): void
    {
        $sale->load('customer');
        $email = $sale->customer?->email;
        if (!$email) return;

        $this->sendSafely($email, new OrderPlacedCustomer($sale));
    }

    /**
     * Email admin about order status change.
     */
    public function sendOrderStatusToAdmin(Sale $sale, string $heading, string $body): void
    {
        $adminEmail = $this->getAdminEmail();
        if (!$adminEmail) return;

        $sale->load('customer');
        $this->sendSafely($adminEmail, new OrderStatusUpdate($sale, $heading, $body));
    }

    /**
     * Email customer about their order status change.
     */
    public function sendOrderStatusToCustomer(Sale $sale, string $heading, string $body): void
    {
        $sale->load('customer');
        $email = $sale->customer?->email;
        if (!$email) return;

        $this->sendSafely($email, new OrderStatusUpdate($sale, $heading, $body));
    }

    /**
     * Send a generic alert email to the admin (no Sale required).
     */
    public function sendAdminAlert(string $subject, string $heading, string $body): void
    {
        $adminEmail = $this->getAdminEmail();
        if (!$adminEmail) return;

        $mailable = (new AdminAlert($heading, $body, $this->getBusinessName()))->subject($subject);

        SendEmail::dispatchAndProcess($adminEmail, $mailable);
    }

    /**
     * Send a generic alert email to a specific address (no Sale required).
     */
    public function sendAlertTo(string $toEmail, string $subject, string $heading, string $body): void
    {
        if (!$toEmail) return;

        $mailable = (new AdminAlert($heading, $body))->subject($subject);

        SendEmail::dispatchAndProcess($toEmail, $mailable);
    }

    /**
     * Email driver when delivery is assigned.
     */
    public function sendDeliveryAssigned(Sale $sale, User $driverUser): void
    {
        if (!$driverUser->email) return;

        $sale->load(['customer', 'items.product.variety']);
        $this->sendSafely($driverUser->email, new DeliveryAssigned($sale, $driverUser->name));
    }

    /**
     * Email driver when a standalone delivery assignment is created.
     */
    public function sendDeliveryAssignmentNotification(User $driverUser, DeliveryAssignment $delivery): void
    {
        if (!$driverUser->email) return;

        $delivery->load(['customer', 'items']);
        $this->sendSafely($driverUser->email, new DeliveryAssignmentNotification($delivery, $driverUser->name));
    }

    /**
     * Email admin on user login.
     */
    public function sendLoginNotification(User $user, string $ipAddress): void
    {
        $adminEmail = $this->getAdminEmail();
        if (!$adminEmail) return;

        $this->sendSafely($adminEmail, new LoginNotification($user, $ipAddress));
    }

    /**
     * Email the customer themselves when they log in.
     */
    public function sendCustomerLoginNotification(User $user, string $ipAddress): void
    {
        if (!$user->email) return;

        $businessName = $this->getBusinessName();

        $this->sendSafely($user->email, new CustomerLoginNotification($user, $ipAddress, $businessName));
    }

    /**
     * Email user when their account is created.
     */
    public function sendWelcomeEmail(User $user): void
    {
        if (!$user->email) return;

        $this->sendSafely($user->email, new WelcomeAccount($user));
    }

    /**
     * Send verification code email.
     */
    public function sendVerificationCode(string $email, string $code, ?string $name = null): void
    {
        $this->sendSafely($email, new VerificationCode($code, $name));
    }

    /**
     * Email supplier when procurement purchase is made.
     */
    public function sendProcurementToSupplier(Procurement $procurement): void
    {
        $procurement->load(['supplier', 'variety']);
        $supplier = $procurement->supplier;

        if (!$supplier || !$supplier->email) return;

        $this->sendSafely($supplier->email, new ProcurementNotification($procurement, $supplier));
    }

    /**
     * Email the business owner / super admin when a procurement purchase is created.
     */
    public function sendProcurementToAdmin(Procurement $procurement): void
    {
        $adminEmail = $this->getAdminEmail();
        if (!$adminEmail) return;

        $procurement->load(['supplier', 'variety']);
        $this->sendSafely($adminEmail, new ProcurementAdminNotification($procurement));
    }

    /**
     * Send daily unpaid orders report to the business owner / super admin.
     */
    public function sendDailyUnpaidOrdersReport(): void
    {
        $unpaidOrders = Sale::where('payment_status', 'not_paid')
            ->whereNotIn('status', ['cancelled', 'voided', 'returned'])
            ->with('customer')
            ->orderBy('created_at', 'desc')
            ->get();

        if ($unpaidOrders->isEmpty()) return;

        $adminEmail = $this->getAdminEmail();
        if (!$adminEmail) return;

        $totalUnpaid = $unpaidOrders->sum('total');
        $this->sendSafely($adminEmail, new DailyUnpaidOrdersReport($unpaidOrders, $totalUnpaid));
    }

    /**
     * Send email change verification code to new email address.
     */
    public function sendEmailChangeVerification(string $newEmail, string $code, string $userName): void
    {
        $this->sendSafely($newEmail, new \App\Mail\EmailChangeVerification($code, $newEmail, $userName));
    }

    /**
     * Send email change notification to old email address.
     */
    public function sendEmailChangeNotification(string $oldEmail, string $newEmail, string $userName, string $ipAddress): void
    {
        $this->sendSafely($oldEmail, new \App\Mail\EmailChangeNotification($oldEmail, $newEmail, $userName, $ipAddress));
    }

    /**
     * Send profile update notification.
     */
    public function sendProfileUpdateNotification(User $user, array $changes, string $ipAddress): void
    {
        if (!$user->email) return;

        $this->sendSafely($user->email, new \App\Mail\ProfileUpdateNotification($user->name, $changes, $ipAddress));
    }

    /**
     * Send security update notification (password change, etc.).
     */
    public function sendSecurityUpdateNotification(User $user, string $updateType, string $ipAddress): void
    {
        if (!$user->email) return;

        $this->sendSafely($user->email, new \App\Mail\SecurityUpdateNotification($user->name, $updateType, $ipAddress));
    }

    /**
     * Send password reset code email.
     */
    public function sendPasswordResetCode(string $email, string $code, string $name): void
    {
        $this->sendSafely($email, new \App\Mail\PasswordResetCode($code, $name));
    }

    /**
     * Send contact form email to business owner.
     */
    public function sendContactEmail(string $toEmail, \App\Models\ContactMessage $contactMessage): void
    {
        $this->sendSafely($toEmail, new \App\Mail\ContactMessageMail($contactMessage));
    }
}
