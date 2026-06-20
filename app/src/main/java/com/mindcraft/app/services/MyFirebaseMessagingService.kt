/**
 * MyFirebaseMessagingService.kt — Firebase Cloud Messaging service
 *
 * Handles incoming push notifications when the app is in the background.
 * Also manages FCM token refresh to keep the Firestore user document updated.
 */
package com.mindcraft.app.services

import android.content.Intent
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.mindcraft.app.activities.MainActivity
import com.mindcraft.app.repository.UserRepository
import com.mindcraft.app.utils.Constants
import com.mindcraft.app.utils.NotificationUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MyFirebaseMessagingService : FirebaseMessagingService() {

    /**
     * Called when a new FCM token is generated.
     * This happens on first app start and when the token changes.
     * We update the token in Firestore so other users can send notifications.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(Constants.LOG_TAG, "New FCM token: $token")

        // Update the token in Firestore
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return
        CoroutineScope(Dispatchers.IO).launch {
            UserRepository().updateFcmToken(uid, token)
        }
    }

    /**
     * Called when a push notification is received while the app is in the foreground.
     * For background messages, Android handles them automatically using the
     * notification payload.
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(Constants.LOG_TAG, "FCM message received: ${message.data}")

        // Extract notification data
        val title = message.notification?.title ?: message.data["title"] ?: getString(com.mindcraft.app.R.string.app_name)
        val body = message.notification?.body ?: message.data["body"] ?: ""
        
        // Create an intent to open MainActivity
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }

        // Show the notification if the app is in the foreground
        NotificationUtils.showNotification(
            context = this,
            title = title,
            body = body,
            intent = intent,
            notificationId = System.currentTimeMillis().toInt()
        )
    }
}
