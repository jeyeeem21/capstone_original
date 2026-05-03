<?php

namespace App\Http\Controllers;

use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;

class NotificationController extends Controller
{
    public function __construct(
        private NotificationService $notificationService
    ) {}

    /**
     * Get notifications for the authenticated user.
     */
    public function index(): JsonResponse
    {
        $notifications = $this->notificationService->getForUser(auth()->id());

        return response()->json([
            'success' => true,
            'data' => $notifications,
        ]);
    }

    /**
     * Get unread notification count.
     */
    public function unreadCount(): JsonResponse
    {
        $count = $this->notificationService->unreadCount(auth()->id());

        return response()->json([
            'success' => true,
            'data' => ['count' => $count],
        ]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markAsRead(int $id): JsonResponse
    {
        $this->notificationService->markAsRead($id, auth()->id());

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read',
        ]);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(): JsonResponse
    {
        $this->notificationService->markAllAsRead(auth()->id());

        return response()->json([
            'success' => true,
            'message' => 'All notifications marked as read',
        ]);
    }
}
