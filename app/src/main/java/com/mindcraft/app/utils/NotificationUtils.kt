/**
 * NotificationUtils.kt — Helper functions for creating and showing notifications
 *
 * Handles creating the notification channel (required for Android 8+) and
 * displaying notifications with proper formatting and tap actions.
 */
package com.mindcraft.app.utils

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.mindcraft.app.R

object NotificationUtils {

    /**
     * Creates the notification channel for the app.
     * Must be called once when the app starts (usually in SplashActivity).
     * On Android 8.0+ (API 26+), a channel is required for notifications.
     *
     * @param context Application context
     */
    fun createNotificationChannel(context: Context) {
        // Notification channels are only needed on Android O (API 26) and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                Constants.NOTIFICATION_CHANNEL_ID,
                context.getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = context.getString(R.string.notification_channel_description)
                enableVibration(true)
            }

            // Register the channel with the system
            val notificationManager = context.getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(channel)
        }
    }

    /**
     * Shows a notification with the given title and body.
     *
     * @param context Application context
     * @param title The notification title
     * @param body The notification body text
     * @param intent The intent to open when the notification is tapped
     * @param notificationId Unique ID for the notification (to update/cancel later)
     */
    fun showNotification(
        context: Context,
        title: String,
        body: String,
        intent: Intent,
        notificationId: Int
    ) {
        // Create a PendingIntent that will open the target activity
        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Build the notification
        val notification = NotificationCompat.Builder(context, Constants.NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_app_logo)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)  // Remove notification when tapped
            .build()

        // Show the notification
        val notificationManager = context.getSystemService(NotificationManager::class.java)
        notificationManager?.notify(notificationId, notification)
    }
}
