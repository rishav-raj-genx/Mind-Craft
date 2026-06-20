/**
 * Match.kt — Data model for a confirmed match between two users
 *
 * When two users accept each other's match request, a Match document is
 * created in the Firestore "matches" collection. This enables chat and sessions.
 */
package com.mindcraft.app.model

data class Match(
    // Unique ID for this match
    val matchId: String = "",

    // UID of the first user in the match
    val user1Uid: String = "",

    // UID of the second user in the match
    val user2Uid: String = "",

    // List of skills that both users share (overlapping teach/learn)
    val sharedSkills: List<String> = emptyList(),

    // Timestamp when the match was created
    val createdAt: Long = 0L,

    // Preview of the last message sent in the chat (for chat list)
    val lastMessage: String = "",

    // Timestamp of the last message (for sorting chat list)
    val lastMessageTime: Long = 0L
)
