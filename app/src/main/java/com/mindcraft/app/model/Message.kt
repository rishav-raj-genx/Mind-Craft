/**
 * Message.kt — Data model for a single chat message
 *
 * Messages are stored as sub-documents inside the "messages/{matchId}/chats"
 * collection in Firestore. They are loaded in real-time using snapshot listeners.
 */
package com.mindcraft.app.model

data class Message(
    // Unique ID for this message
    val messageId: String = "",

    // UID of the user who sent the message
    val senderUid: String = "",

    // The text content of the message
    val text: String = "",

    // Timestamp when the message was sent (millis since epoch)
    val timestamp: Long = 0L,

    // Whether the recipient has read this message
    val read: Boolean = false
)
