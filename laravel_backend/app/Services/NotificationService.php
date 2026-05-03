<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;

class NotificationService
{
    /**
     * Create a notification for a specific user.
     */
    public function notify(int $userId, string $type, string $title, string $message, ?array $data = null): Notification
    {
        return Notification::create([
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => $data,
        ]);
    }

    /**
     * Send a notification to all admin and super_admin users.
     */
    public function notifyAdmins(string $type, string $title, string $message, ?array $data = null): void
    {
        $admins = User::whereIn('role', [User::ROLE_SUPER_ADMIN, User::ROLE_ADMIN])
            ->where('status', 'active')
            ->get();

        foreach ($admins as $admin) {
            $this->notify($admin->id, $type, $title, $message, $data);
        }
    }

    /**
     * Send a notification to a specific driver user (by staff user_id).
     */
    public function notifyDriver(int $userId, string $type, string $title, string $message, ?array $data = null): void
    {
        $this->notify($userId, $type, $title, $message, $data);
    }

    /**
     * Send a notification to a customer's linked user account.
     */
    public function notifyCustomerUser(int $userId, string $type, string $title, string $message, ?array $data = null): void
    {
        $this->notify($userId, $type, $title, $message, $data);
    }

    /**
     * Get notifications for a user (paginated, newest first).
     */
    public function getForUser(int $userId, int $limit = 30): \Illuminate\Database\Eloquent\Collection
    {
        return Notification::forUser($userId)
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Get unread count for a user.
     */
    public function unreadCount(int $userId): int
    {
        return Notification::forUser($userId)->unread()->count();
    }

    /**
     * Mark a single notification as read.
     */
    public function markAsRead(int $notificationId, int $userId): void
    {
        Notification::where('id', $notificationId)
            ->where('user_id', $userId)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
    }

    /**
     * Mark all notifications as read for a user.
     */
    public function markAllAsRead(int $userId): void
    {
        Notification::forUser($userId)
            ->unread()
            ->update(['read_at' => now()]);
    }
}
