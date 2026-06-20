/**
 * User.kt — Data model for a Mind Craft user
 *
 * This class represents a user in the app. It maps directly to a document
 * in the Firestore "users" collection. Each field matches a Firestore field.
 *
 * We use default values so Firestore can create User objects automatically.
 */
package com.mindcraft.app.model

data class User(
    // Unique user ID (from Firebase Auth)
    val uid: String = "",

    // User's full name (from Google account)
    val name: String = "",

    // User's email address (from Google account)
    val email: String = "",

    // URL to the user's profile photo (from Google account)
    val photoUrl: String = "",

    // Name of the college, school, or university
    val college: String = "",

    // Department or branch (e.g. "Computer Science")
    val department: String = "",

    // Year of study (e.g. "1st", "2nd", "Faculty")
    val year: String = "",

    // List of skills this user can teach others
    val teaches: List<String> = emptyList(),

    // List of skills this user wants to learn
    val learns: List<String> = emptyList(),

    // Firebase Cloud Messaging token for push notifications
    val fcmToken: String = "",

    // User's latitude for location-based features
    val latitude: Double = 0.0,

    // User's longitude for location-based features
    val longitude: Double = 0.0,

    // Timestamp of last location update (millis since epoch)
    val lastLocationUpdate: Long = 0L,

    // Average rating from completed sessions (0.0 to 5.0)
    val averageRating: Float = 0f,

    // Total number of sessions completed
    val totalSessions: Int = 0,

    // Coding Platform Usernames (for Coding Profile feature)
    val leetcodeUsername: String = "",
    val codeforcesUsername: String = "",
    val codechefUsername: String = "",

    // Timestamp when the account was created
    val createdAt: Long = 0L
)
