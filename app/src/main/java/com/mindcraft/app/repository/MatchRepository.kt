/**
 * MatchRepository.kt — Handles matching algorithm and match-related Firestore operations
 *
 * This repository contains the core matching logic that finds compatible peers
 * based on skill overlap. It also manages match requests and confirmed matches.
 */
package com.mindcraft.app.repository

import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import com.mindcraft.app.model.Match
import com.mindcraft.app.model.MatchRequest
import com.mindcraft.app.model.User
import com.mindcraft.app.utils.Constants
import com.mindcraft.app.utils.LocationUtils
import kotlinx.coroutines.tasks.await

class MatchRepository {

    // Reference to the Firestore database
    private val db = FirebaseFirestore.getInstance()

    // References to collections
    private val usersCollection = db.collection(Constants.COLLECTION_USERS)
    private val matchRequestsCollection = db.collection(Constants.COLLECTION_MATCH_REQUESTS)
    private val matchesCollection = db.collection(Constants.COLLECTION_MATCHES)

    /**
     * Finds users whose "teaches" list contains ANY skill from my "learns" list.
     * This is the core matching algorithm — it finds peers who can teach me
     * what I want to learn. Results are sorted by distance (closest first).
     *
     * @param currentUser The currently logged-in user
     * @return List of matching users, sorted by distance
     */
    suspend fun findMatches(currentUser: User): List<User> {
        val results = mutableListOf<User>()

        try {
            // Step 1: For each skill I want to learn, find users who teach it
            for (skill in currentUser.learns) {
                val snapshot = usersCollection
                    .whereArrayContains("teaches", skill)
                    .get()
                    .await()
                results.addAll(snapshot.toObjects(User::class.java))
            }

            // Step 2: Filter out myself from the results
            val filtered = results.filter { it.uid != currentUser.uid }

            // Step 3: Remove duplicate users (a user might teach multiple skills I want)
            val unique = filtered.distinctBy { it.uid }

            // Step 4: Sort by distance using the Haversine formula (closest first)
            return unique.sortedBy { LocationUtils.calculateDistanceKm(currentUser, it) }

        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error finding matches: ${e.message}")
            return emptyList()
        }
    }

    /**
     * Sends a match request to another user.
     * Creates a document in the "matchRequests" collection with status "pending".
     *
     * @param fromUid The sender's UID
     * @param toUid The receiver's UID
     * @param sharedSkill The skill that triggered the match
     * @return true if the request was sent successfully
     */
    suspend fun sendMatchRequest(fromUid: String, toUid: String, sharedSkill: String): Boolean {
        return try {
            // Generate a unique request ID
            val requestId = matchRequestsCollection.document().id

            val request = MatchRequest(
                requestId = requestId,
                fromUid = fromUid,
                toUid = toUid,
                sharedSkill = sharedSkill,
                status = Constants.STATUS_PENDING,
                createdAt = System.currentTimeMillis()
            )

            matchRequestsCollection.document(requestId).set(request).await()
            Log.d(Constants.LOG_TAG, "Match request sent: $requestId")
            true
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error sending match request: ${e.message}")
            false
        }
    }

    /**
     * Gets all pending match requests sent TO the current user.
     * These are requests from other users waiting for acceptance.
     *
     * @param uid The current user's UID
     * @return List of pending MatchRequests
     */
    suspend fun getIncomingRequests(uid: String): List<MatchRequest> {
        return try {
            val snapshot = matchRequestsCollection
                .whereEqualTo("toUid", uid)
                .whereEqualTo("status", Constants.STATUS_PENDING)
                .get()
                .await()
            snapshot.toObjects(MatchRequest::class.java)
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error getting incoming requests: ${e.message}")
            emptyList()
        }
    }

    /**
     * Accepts a match request. This:
     * 1. Updates the request status to "accepted"
     * 2. Creates a new Match document in the "matches" collection
     *
     * @param request The match request to accept
     * @param currentUser The current user (who is accepting)
     * @param otherUser The user who sent the request
     * @return true if successfully accepted
     */
    suspend fun acceptMatchRequest(
        request: MatchRequest,
        currentUser: User,
        otherUser: User
    ): Boolean {
        return try {
            // Update request status to accepted
            matchRequestsCollection.document(request.requestId)
                .update("status", Constants.STATUS_ACCEPTED)
                .await()

            // Find shared skills between the two users
            val sharedSkills = findSharedSkills(currentUser, otherUser)

            // Create a new match document
            val matchId = matchesCollection.document().id
            val match = Match(
                matchId = matchId,
                user1Uid = request.fromUid,
                user2Uid = request.toUid,
                sharedSkills = sharedSkills,
                createdAt = System.currentTimeMillis()
            )

            matchesCollection.document(matchId).set(match).await()
            Log.d(Constants.LOG_TAG, "Match created: $matchId")
            true
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error accepting match request: ${e.message}")
            false
        }
    }

    /**
     * Declines a match request by updating its status.
     *
     * @param requestId The ID of the request to decline
     * @return true if successfully declined
     */
    suspend fun declineMatchRequest(requestId: String): Boolean {
        return try {
            matchRequestsCollection.document(requestId)
                .update("status", Constants.STATUS_DECLINED)
                .await()
            true
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error declining match request: ${e.message}")
            false
        }
    }

    /**
     * Gets all confirmed matches for the current user.
     * A user can be either user1 or user2 in a match.
     *
     * @param uid The current user's UID
     * @return List of Match objects
     */
    suspend fun getMyMatches(uid: String): List<Match> {
        return try {
            // Query where user is user1
            val asUser1 = matchesCollection
                .whereEqualTo("user1Uid", uid)
                .get()
                .await()
                .toObjects(Match::class.java)

            // Query where user is user2
            val asUser2 = matchesCollection
                .whereEqualTo("user2Uid", uid)
                .get()
                .await()
                .toObjects(Match::class.java)

            // Combine both lists
            (asUser1 + asUser2).sortedByDescending { it.lastMessageTime }
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error getting matches: ${e.message}")
            emptyList()
        }
    }

    /**
     * Checks if a match request already exists between two users.
     * Prevents sending duplicate requests.
     *
     * @param fromUid Sender's UID
     * @param toUid Receiver's UID
     * @return true if a pending request already exists
     */
    suspend fun hasExistingRequest(fromUid: String, toUid: String): Boolean {
        return try {
            val snapshot = matchRequestsCollection
                .whereEqualTo("fromUid", fromUid)
                .whereEqualTo("toUid", toUid)
                .whereEqualTo("status", Constants.STATUS_PENDING)
                .get()
                .await()
            snapshot.documents.isNotEmpty()
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Checks if two users are already matched.
     *
     * @param uid1 First user's UID
     * @param uid2 Second user's UID
     * @return true if a match exists between the two users
     */
    suspend fun areMatched(uid1: String, uid2: String): Boolean {
        return try {
            val asUser1 = matchesCollection
                .whereEqualTo("user1Uid", uid1)
                .whereEqualTo("user2Uid", uid2)
                .get()
                .await()

            if (asUser1.documents.isNotEmpty()) return true

            val asUser2 = matchesCollection
                .whereEqualTo("user1Uid", uid2)
                .whereEqualTo("user2Uid", uid1)
                .get()
                .await()

            asUser2.documents.isNotEmpty()
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Finds the matchId between two users.
     * Returns the matchId string or null if not found.
     */
    suspend fun findMatchId(uid1: String, uid2: String): String? {
        return try {
            val asUser1 = matchesCollection
                .whereEqualTo("user1Uid", uid1)
                .whereEqualTo("user2Uid", uid2)
                .get()
                .await()
            if (asUser1.documents.isNotEmpty()) {
                return asUser1.documents.first().toObject(Match::class.java)?.matchId
            }
            val asUser2 = matchesCollection
                .whereEqualTo("user1Uid", uid2)
                .whereEqualTo("user2Uid", uid1)
                .get()
                .await()
            asUser2.documents.firstOrNull()?.toObject(Match::class.java)?.matchId
        } catch (e: Exception) {
            Log.d(Constants.LOG_TAG, "Error finding matchId: ${e.message}")
            null
        }
    }

    /**
     * Finds skills that are shared between two users.
     * A "shared skill" is when user1 teaches what user2 wants to learn, or vice versa.
     *
     * @param user1 First user
     * @param user2 Second user
     * @return List of shared skill names
     */
    private fun findSharedSkills(user1: User, user2: User): List<String> {
        val shared = mutableListOf<String>()

        // Skills that user1 teaches and user2 wants to learn
        shared.addAll(user1.teaches.intersect(user2.learns.toSet()))

        // Skills that user2 teaches and user1 wants to learn
        shared.addAll(user2.teaches.intersect(user1.learns.toSet()))

        return shared.distinct()
    }
}
