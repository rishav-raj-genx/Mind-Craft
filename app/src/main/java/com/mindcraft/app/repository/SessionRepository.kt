/**
 * SessionRepository.kt — Handles all session-related Firestore operations
 *
 * This repository manages booking, updating, and rating learning sessions
 * between matched peers.
 */
package com.mindcraft.app.repository

import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import com.mindcraft.app.model.Session
import com.mindcraft.app.utils.Constants
import kotlinx.coroutines.tasks.await

class SessionRepository {

    // Reference to the Firestore database
    private val db = FirebaseFirestore.getInstance()

    // Reference to the "sessions" collection
    private val sessionsCollection = db.collection(Constants.COLLECTION_SESSIONS)

    // Reference to the "users" collection (for updating ratings)
    private val usersCollection = db.collection(Constants.COLLECTION_USERS)

    /**
     * Books a new learning session.
     * Creates a document in the "sessions" collection.
     *
     * @param session The Session object to save
     * @return true if the session was booked successfully
     */
    suspend fun bookSession(session: Session): Boolean {
        return try {
            sessionsCollection.document(session.sessionId).set(session).await()
            Log.d(Constants.LOG_TAG, "Session booked: ${session.sessionId}")
            true
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error booking session: ${e.message}")
            false
        }
    }

    /**
     * Gets sessions for a user, filtered by status.
     * A user can be either the teacher or learner in a session.
     *
     * @param uid The user's UID
     * @param status The session status to filter by ("upcoming", "completed", "cancelled")
     * @return List of sessions matching the criteria
     */
    suspend fun getSessionsByStatus(uid: String, status: String): List<Session> {
        return try {
            // Get sessions where user is the teacher
            val asTeacher = sessionsCollection
                .whereEqualTo("teacherUid", uid)
                .whereEqualTo("status", status)
                .get()
                .await()
                .toObjects(Session::class.java)

            // Get sessions where user is the learner
            val asLearner = sessionsCollection
                .whereEqualTo("learnerUid", uid)
                .whereEqualTo("status", status)
                .get()
                .await()
                .toObjects(Session::class.java)

            // Combine and sort by scheduled time
            (asTeacher + asLearner).sortedBy { it.scheduledAt }
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error getting sessions: ${e.message}")
            emptyList()
        }
    }

    /**
     * Cancels a session by updating its status to "cancelled".
     *
     * @param sessionId The ID of the session to cancel
     * @return true if the session was cancelled successfully
     */
    suspend fun cancelSession(sessionId: String): Boolean {
        return try {
            sessionsCollection.document(sessionId)
                .update("status", Constants.SESSION_CANCELLED)
                .await()
            true
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error cancelling session: ${e.message}")
            false
        }
    }

    /**
     * Rates a completed session.
     * Updates the session's rating and comment, then recalculates
     * the teacher's average rating.
     *
     * @param sessionId The session to rate
     * @param rating The star rating (1.0 to 5.0)
     * @param comment Optional text comment
     * @param teacherUid The teacher's UID (to update their average rating)
     * @return true if the rating was submitted successfully
     */
    suspend fun rateSession(
        sessionId: String,
        rating: Float,
        comment: String,
        teacherUid: String
    ): Boolean {
        return try {
            // Update the session with the rating
            sessionsCollection.document(sessionId).update(
                mapOf(
                    "rating" to rating,
                    "ratingComment" to comment,
                    "status" to Constants.SESSION_COMPLETED
                )
            ).await()

            // Recalculate the teacher's average rating
            updateTeacherRating(teacherUid)

            Log.d(Constants.LOG_TAG, "Session rated: $sessionId")
            true
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error rating session: ${e.message}")
            false
        }
    }

    /**
     * Recalculates and updates a teacher's average rating.
     * Queries all completed sessions where this user was the teacher
     * and computes the new average.
     *
     * @param teacherUid The teacher's UID
     */
    private suspend fun updateTeacherRating(teacherUid: String) {
        try {
            // Get all rated sessions for this teacher
            val snapshot = sessionsCollection
                .whereEqualTo("teacherUid", teacherUid)
                .whereEqualTo("status", Constants.SESSION_COMPLETED)
                .get()
                .await()

            val sessions = snapshot.toObjects(Session::class.java)
            val ratedSessions = sessions.filter { it.rating > 0 }

            if (ratedSessions.isNotEmpty()) {
                // Calculate average rating
                val avgRating = ratedSessions.map { it.rating }.average().toFloat()

                // Update the user's profile with new average
                usersCollection.document(teacherUid).update(
                    mapOf(
                        "averageRating" to avgRating,
                        "totalSessions" to sessions.size
                    )
                ).await()
            }
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error updating teacher rating: ${e.message}")
        }
    }

    /**
     * Gets all sessions for a specific match (used for reviews on peer profile).
     *
     * @param teacherUid The teacher's UID
     * @return List of completed and rated sessions
     */
    suspend fun getReviewsForUser(teacherUid: String): List<Session> {
        return try {
            sessionsCollection
                .whereEqualTo("teacherUid", teacherUid)
                .whereEqualTo("status", Constants.SESSION_COMPLETED)
                .get()
                .await()
                .toObjects(Session::class.java)
                .filter { it.rating > 0 }
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error getting reviews: ${e.message}")
            emptyList()
        }
    }
}
