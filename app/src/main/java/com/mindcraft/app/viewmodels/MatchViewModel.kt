/**
 * MatchViewModel.kt — ViewModel for the Match screen
 *
 * Manages discovering new matches, handling incoming requests,
 * and displaying current matches. Provides data for all three tabs.
 */
package com.mindcraft.app.viewmodels

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mindcraft.app.model.Match
import com.mindcraft.app.model.MatchRequest
import com.mindcraft.app.model.User
import com.mindcraft.app.repository.MatchRepository
import com.mindcraft.app.repository.UserRepository
import kotlinx.coroutines.launch

class MatchViewModel : ViewModel() {

    // Repositories
    private val matchRepository = MatchRepository()
    private val userRepository = UserRepository()

    // LiveData for discovered matches (potential peers)
    private val _discoveredMatches = MutableLiveData<List<User>>()
    val discoveredMatches: LiveData<List<User>> get() = _discoveredMatches

    // LiveData for incoming match requests
    private val _incomingRequests = MutableLiveData<List<MatchRequest>>()
    val incomingRequests: LiveData<List<MatchRequest>> get() = _incomingRequests

    // LiveData for User objects corresponding to incoming requests
    private val _requestUsers = MutableLiveData<List<User>>()
    val requestUsers: LiveData<List<User>> get() = _requestUsers

    // LiveData for confirmed matches
    private val _myMatches = MutableLiveData<List<Match>>()
    val myMatches: LiveData<List<Match>> get() = _myMatches

    // LiveData for User objects corresponding to confirmed matches
    private val _matchUsers = MutableLiveData<List<User>>()
    val matchUsers: LiveData<List<User>> get() = _matchUsers

    // Loading and error states
    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> get() = _isLoading

    private val _actionResult = MutableLiveData<String?>()
    val actionResult: LiveData<String?> get() = _actionResult

    /**
     * Gets the current user's UID.
     */
    fun getCurrentUid(): String? = userRepository.getCurrentUid()

    /**
     * Loads all match-related data: discovers, requests, and confirmed matches.
     */
    fun loadAllMatchData() {
        _isLoading.value = true
        viewModelScope.launch {
            val currentUser = userRepository.getCurrentUser()
            if (currentUser != null) {
                loadDiscoveredMatches(currentUser)
                loadIncomingRequests(currentUser.uid)
                loadMyMatches(currentUser.uid)
            }
            _isLoading.value = false
        }
    }

    /**
     * Discovers new peers that match the current user's skills.
     */
    private suspend fun loadDiscoveredMatches(currentUser: User) {
        val matches = matchRepository.findMatches(currentUser)
        _discoveredMatches.value = matches
    }

    /**
     * Loads pending match requests for the current user.
     * Also loads the User profiles for each request sender.
     */
    private suspend fun loadIncomingRequests(uid: String) {
        val requests = matchRepository.getIncomingRequests(uid)
        _incomingRequests.value = requests

        // Load user profiles for each request sender
        val users = mutableListOf<User>()
        for (request in requests) {
            val user = userRepository.getUser(request.fromUid)
            if (user != null) users.add(user)
        }
        _requestUsers.value = users
    }

    /**
     * Loads confirmed matches for the current user.
     * Also loads the peer User profiles for each match.
     */
    private suspend fun loadMyMatches(uid: String) {
        val matches = matchRepository.getMyMatches(uid)
        _myMatches.value = matches

        // Load peer user profiles for each match
        val users = mutableListOf<User>()
        for (match in matches) {
            val peerUid = if (match.user1Uid == uid) match.user2Uid else match.user1Uid
            val user = userRepository.getUser(peerUid)
            if (user != null) users.add(user)
        }
        _matchUsers.value = users
    }

    /**
     * Sends a match request to another user.
     *
     * @param toUid The recipient's UID
     * @param sharedSkill The skill that connects the two users
     */
    fun sendMatchRequest(toUid: String, sharedSkill: String) {
        val fromUid = userRepository.getCurrentUid() ?: return
        viewModelScope.launch {
            val success = matchRepository.sendMatchRequest(fromUid, toUid, sharedSkill)
            _actionResult.value = if (success) "match_sent" else "error"
        }
    }

    /**
     * Accepts a match request from another user.
     *
     * @param request The request to accept
     */
    fun acceptRequest(request: MatchRequest) {
        viewModelScope.launch {
            val currentUser = userRepository.getCurrentUser() ?: return@launch
            val otherUser = userRepository.getUser(request.fromUid) ?: return@launch

            val success = matchRepository.acceptMatchRequest(request, currentUser, otherUser)
            _actionResult.value = if (success) "request_accepted" else "error"

            // Refresh the data
            if (success) {
                loadIncomingRequests(currentUser.uid)
                loadMyMatches(currentUser.uid)
            }
        }
    }

    /**
     * Declines a match request.
     *
     * @param requestId The ID of the request to decline
     */
    fun declineRequest(requestId: String) {
        viewModelScope.launch {
            val success = matchRepository.declineMatchRequest(requestId)
            _actionResult.value = if (success) "request_declined" else "error"

            val uid = userRepository.getCurrentUid() ?: return@launch
            if (success) loadIncomingRequests(uid)
        }
    }

    /**
     * Resets the action result to prevent re-triggering.
     */
    fun resetActionResult() {
        _actionResult.value = null
    }
}
