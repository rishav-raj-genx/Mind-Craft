/**
 * MatchRequest.kt — Data model for a pending match request
 *
 * When a user taps "Connect" on another user's profile, a MatchRequest
 * is created in the Firestore "matchRequests" collection with status "pending".
 * The other user can then accept or decline it.
 */
package com.mindcraft.app.model

data class MatchRequest(
    // Unique ID for this request
    val requestId: String = "",

    // UID of the user who sent the request
    val fromUid: String = "",

    // UID of the user who received the request
    val toUid: String = "",

    // The skill that triggered the match
    val sharedSkill: String = "",

    // Current status: "pending", "accepted", or "declined"
    val status: String = "",

    // Timestamp when the request was created
    val createdAt: Long = 0L
)
