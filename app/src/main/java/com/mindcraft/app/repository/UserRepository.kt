/**
 * UserRepository.kt — Handles all user-related Firestore operations
 *
 * This repository manages creating, reading, and updating user profiles
 * in the Firestore "users" collection. It also handles location updates
 * and FCM token management.
 */
package com.mindcraft.app.repository

import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.mindcraft.app.model.User
import com.mindcraft.app.utils.Constants
import kotlinx.coroutines.tasks.await

class UserRepository {

    // Reference to the Firestore database
    private val db = FirebaseFirestore.getInstance()

    // Reference to Firebase Auth for getting the current user
    private val auth = FirebaseAuth.getInstance()

    // Reference to the "users" collection
    private val usersCollection = db.collection(Constants.COLLECTION_USERS)

    /**
     * Gets the current logged-in user's UID.
     * Returns null if no user is logged in.
     */
    fun getCurrentUid(): String? {
        return auth.currentUser?.uid
    }

    /**
     * Checks if a user document already exists in Firestore.
     * Used after login to determine if this is a new or returning user.
     *
     * @param uid The user's Firebase Auth UID
     * @return true if the user document exists, false otherwise
     */
    suspend fun doesUserExist(uid: String): Boolean {
        return try {
            val document = usersCollection.document(uid).get().await()
            document.exists()
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error checking user existence: ${e.message}")
            false
        }
    }

    /**
     * Creates a new user document in Firestore.
     * Called during the profile setup process for first-time users.
     *
     * @param user The User object to save
     * @return true if the save was successful, false otherwise
     */
    suspend fun createUser(user: User): Boolean {
        return try {
            usersCollection.document(user.uid).set(user).await()
            Log.d(Constants.LOG_TAG, "User created successfully: ${user.uid}")
            true
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error creating user: ${e.message}")
            false
        }
    }

    /**
     * Gets a user document from Firestore by UID.
     *
     * @param uid The user's Firebase Auth UID
     * @return The User object, or null if not found
     */
    suspend fun getUser(uid: String): User? {
        return try {
            val document = usersCollection.document(uid).get().await()
            document.toObject(User::class.java)
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error getting user: ${e.message}")
            null
        }
    }

    /**
     * Gets the currently logged-in user's profile from Firestore.
     *
     * @return The current User object, or null if not found/not logged in
     */
    suspend fun getCurrentUser(): User? {
        val uid = getCurrentUid() ?: return null
        return getUser(uid)
    }

    /**
     * Updates the user's location in Firestore.
     * Called every time the app comes to the foreground.
     *
     * @param uid The user's UID
     * @param latitude The current latitude (rounded for privacy)
     * @param longitude The current longitude (rounded for privacy)
     */
    suspend fun updateLocation(uid: String, latitude: Double, longitude: Double) {
        try {
            usersCollection.document(uid).update(
                mapOf(
                    "latitude" to latitude,
                    "longitude" to longitude,
                    "lastLocationUpdate" to System.currentTimeMillis()
                )
            ).await()
            Log.d(Constants.LOG_TAG, "Location updated for user: $uid")
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error updating location: ${e.message}")
        }
    }

    /**
     * Updates the FCM token for push notifications.
     * Called when the app starts and when FCM refreshes the token.
     *
     * @param uid The user's UID
     * @param token The new FCM token
     */
    suspend fun updateFcmToken(uid: String, token: String) {
        try {
            usersCollection.document(uid).update("fcmToken", token).await()
            Log.d(Constants.LOG_TAG, "FCM token updated for user: $uid")
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error updating FCM token: ${e.message}")
        }
    }

    /**
     * Updates the user's profile fields.
     * Used from the My Profile edit screen.
     *
     * @param uid The user's UID
     * @param updates Map of field names to new values
     * @return true if update was successful
     */
    suspend fun updateProfile(uid: String, updates: Map<String, Any>): Boolean {
        return try {
            usersCollection.document(uid).update(updates).await()
            Log.d(Constants.LOG_TAG, "Profile updated for user: $uid")
            true
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error updating profile: ${e.message}")
            false
        }
    }

    /**
     * Gets all users within a geographic bounding box.
     * Used to find nearby peers for the home screen map.
     *
     * @param minLat Minimum latitude of the bounding box
     * @param maxLat Maximum latitude of the bounding box
     * @return List of users within the latitude range
     */
    suspend fun getNearbyUsers(minLat: Double, maxLat: Double): List<User> {
        return try {
            // Query by latitude range (Firestore can only filter one field with range)
            val snapshot = usersCollection
                .whereGreaterThanOrEqualTo("latitude", minLat)
                .whereLessThanOrEqualTo("latitude", maxLat)
                .get()
                .await()

            val users = snapshot.toObjects(User::class.java)

            // Filter out stale locations (older than 24 hours)
            val cutoff = System.currentTimeMillis() - Constants.LOCATION_STALE_THRESHOLD_MS
            users.filter { it.lastLocationUpdate > cutoff }
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error getting nearby users: ${e.message}")
            emptyList()
        }
    }

    /**
     * Signs the user out of Firebase Auth.
     */
    fun signOut() {
        auth.signOut()
    }
}
