/**
 * Constants.kt — App-wide constants and configuration values
 *
 * This file holds all the predefined skill lists, Firestore collection names,
 * and other constant values used throughout the app.
 */
package com.mindcraft.app.utils

object Constants {

    // ----- Firestore Collection Names -----
    const val COLLECTION_USERS = "users"
    const val COLLECTION_MATCH_REQUESTS = "matchRequests"
    const val COLLECTION_MATCHES = "matches"
    const val COLLECTION_MESSAGES = "messages"
    const val COLLECTION_CHATS = "chats"
    const val COLLECTION_SESSIONS = "sessions"

    // ----- Match Request Status Values -----
    const val STATUS_PENDING = "pending"
    const val STATUS_ACCEPTED = "accepted"
    const val STATUS_DECLINED = "declined"

    // ----- Session Status Values -----
    const val SESSION_UPCOMING = "upcoming"
    const val SESSION_COMPLETED = "completed"
    const val SESSION_CANCELLED = "cancelled"

    // ----- Session Mode Values -----
    const val MODE_ONLINE = "Online"
    const val MODE_IN_PERSON = "In-Person"

    // ----- Location Config -----
    // Maximum distance in km to show nearby peers on the map
    const val MAX_DISTANCE_KM = 10.0

    // Maximum age of location data (24 hours in milliseconds)
    const val LOCATION_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000L

    // Location update interval when app is in foreground (60 seconds)
    const val LOCATION_UPDATE_INTERVAL_MS = 60 * 1000L

    // Number of decimal places to round location for privacy
    const val LOCATION_PRIVACY_DECIMALS = 2

    // ----- Notification Channels -----
    const val NOTIFICATION_CHANNEL_ID = "mindcraft_notifications"
    const val NOTIFICATION_CHANNEL_GENERAL = "mindcraft_general"
    const val NOTIFICATION_CHANNEL_MATCHES = "mindcraft_matches"
    const val NOTIFICATION_CHANNEL_MESSAGES = "mindcraft_messages"
    const val NOTIFICATION_CHANNEL_SESSIONS = "mindcraft_sessions"

    // ----- Educational Email Domains -----
    // List of recognized educational email domain endings
    val EDU_DOMAINS = listOf(
        ".edu",
        ".ac.in",
        ".edu.in",
        ".ac.uk",
        ".edu.au",
        ".edu.cn",
        ".ac.jp",
        ".edu.sg",
        ".ac.nz"
    )

    // ----- Predefined Skills List -----
    val SKILLS_LIST = listOf(
        "Python",
        "Java",
        "Kotlin",
        "DSA",
        "Machine Learning",
        "Web Dev",
        "React",
        "SQL",
        "UI/UX Design",
        "Figma",
        "Mathematics",
        "Physics",
        "Chemistry",
        "English Communication",
        "Public Speaking",
        "Graphic Design",
        "Video Editing",
        "Excel/Sheets",
        "Cybersecurity",
        "Cloud Computing",
        "Arduino/IoT",
        "Circuit Design",
        "CAD",
        "Economics",
        "Accounting"
    )

    // ----- Year Options -----
    val YEAR_OPTIONS = listOf(
        "1st Year",
        "2nd Year",
        "3rd Year",
        "4th Year",
        "Faculty"
    )

    // ----- Logging Tag -----
    const val LOG_TAG = "MindCraft"

    // ----- Splash Delay -----
    const val SPLASH_DELAY_MS = 2000L
}
