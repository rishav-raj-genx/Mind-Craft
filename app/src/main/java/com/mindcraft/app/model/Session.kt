/**
 * Session.kt — Data model for a learning session between two peers
 *
 * Sessions are created when one user books a session from the chat screen.
 * They track the skill topic, schedule, mode (online/in-person), and rating.
 */
package com.mindcraft.app.model

data class Session(
    // Unique ID for this session
    val sessionId: String = "",

    // The match ID linking the two users
    val matchId: String = "",

    // UID of the user who is teaching
    val teacherUid: String = "",

    // UID of the user who is learning
    val learnerUid: String = "",

    // The skill being taught in this session
    val skill: String = "",

    // Scheduled date and time (millis since epoch)
    val scheduledAt: Long = 0L,

    // Mode of the session: "Online" or "In-Person"
    val mode: String = "",

    // Google Meet link (only for online sessions)
    val meetLink: String = "",

    // Location description (only for in-person sessions)
    val location: String = "",

    // Optional notes about the session
    val notes: String = "",

    // Current status: "upcoming", "completed", or "cancelled"
    val status: String = "",

    // Rating given after the session (1.0 to 5.0, 0 if not rated)
    val rating: Float = 0f,

    // Optional text review/comment with the rating
    val ratingComment: String = "",

    // Timestamp when the session was created
    val createdAt: Long = 0L
)
