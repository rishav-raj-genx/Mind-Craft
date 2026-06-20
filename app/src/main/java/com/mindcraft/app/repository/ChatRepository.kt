/**
 * ChatRepository.kt — Handles all chat-related Firestore operations
 *
 * This repository manages sending messages, listening for real-time updates,
 * and managing chat threads between matched peers.
 */
package com.mindcraft.app.repository

import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.mindcraft.app.model.Message
import com.mindcraft.app.utils.Constants
import kotlinx.coroutines.tasks.await

class ChatRepository {

    // Reference to the Firestore database
    private val db = FirebaseFirestore.getInstance()

    // Reference to the "messages" collection
    private val messagesCollection = db.collection(Constants.COLLECTION_MESSAGES)

    // Reference to the "matches" collection (for updating last message)
    private val matchesCollection = db.collection(Constants.COLLECTION_MATCHES)

    /**
     * Sends a message in a chat thread.
     * Creates a new document in "messages/{matchId}/chats" and updates
     * the match's lastMessage and lastMessageTime fields.
     *
     * @param matchId The ID of the match this chat belongs to
     * @param senderUid The UID of the user sending the message
     * @param text The message text
     * @return true if the message was sent successfully
     */
    suspend fun sendMessage(matchId: String, senderUid: String, text: String): Boolean {
        return try {
            // Create a unique message ID
            val chatRef = messagesCollection.document(matchId)
                .collection(Constants.COLLECTION_CHATS)
            val messageId = chatRef.document().id

            // Build the message object
            val message = Message(
                messageId = messageId,
                senderUid = senderUid,
                text = text,
                timestamp = System.currentTimeMillis(),
                read = false
            )

            // Save the message to Firestore
            chatRef.document(messageId).set(message).await()

            // Update the match's last message preview
            matchesCollection.document(matchId).update(
                mapOf(
                    "lastMessage" to text,
                    "lastMessageTime" to System.currentTimeMillis()
                )
            ).await()

            Log.d(Constants.LOG_TAG, "Message sent in match: $matchId")
            true
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error sending message: ${e.message}")
            false
        }
    }

    /**
     * Sets up a real-time listener for messages in a chat thread.
     * The callback is called every time a new message arrives or changes.
     *
     * @param matchId The match ID to listen for messages
     * @param callback Function called with the updated list of messages
     * @return ListenerRegistration that can be used to stop listening
     */
    fun listenForMessages(
        matchId: String,
        callback: (List<Message>) -> Unit
    ): ListenerRegistration {
        return messagesCollection.document(matchId)
            .collection(Constants.COLLECTION_CHATS)
            .orderBy("timestamp", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.d(Constants.LOG_TAG, "Error listening for messages: ${error.message}")
                    return@addSnapshotListener
                }

                // Convert the snapshot to a list of Message objects
                val messages = snapshot?.toObjects(Message::class.java) ?: emptyList()
                callback(messages)
            }
    }

    /**
     * Marks all unread messages as read for a specific user in a chat.
     *
     * @param matchId The match ID of the chat
     * @param readByUid The UID of the user who read the messages
     */
    suspend fun markMessagesAsRead(matchId: String, readByUid: String) {
        try {
            val snapshot = messagesCollection.document(matchId)
                .collection(Constants.COLLECTION_CHATS)
                .whereEqualTo("read", false)
                .get()
                .await()

            // Only mark messages that were NOT sent by the current user
            for (doc in snapshot.documents) {
                val message = doc.toObject(Message::class.java)
                if (message != null && message.senderUid != readByUid) {
                    doc.reference.update("read", true)
                }
            }
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error marking messages as read: ${e.message}")
        }
    }

    /**
     * Gets the count of unread messages for a user in a specific chat.
     *
     * @param matchId The match ID of the chat
     * @param uid The current user's UID
     * @return Number of unread messages
     */
    suspend fun getUnreadCount(matchId: String, uid: String): Int {
        return try {
            val snapshot = messagesCollection.document(matchId)
                .collection(Constants.COLLECTION_CHATS)
                .whereEqualTo("read", false)
                .get()
                .await()

            // Count messages NOT sent by the current user
            snapshot.documents.count { doc ->
                val message = doc.toObject(Message::class.java)
                message?.senderUid != uid
            }
        } catch (e: Exception) {
            0
        }
    }
}
