/**
 * HomeViewModel.kt — ViewModel for the Home screen (Map + Nearby Peers)
 *
 * Manages loading nearby peers, determining match types,
 * and providing data for the map markers and bottom sheet list.
 */
package com.mindcraft.app.viewmodels

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mindcraft.app.model.User
import com.mindcraft.app.repository.UserRepository
import com.mindcraft.app.utils.Constants
import com.mindcraft.app.utils.LocationUtils
import kotlinx.coroutines.launch

class HomeViewModel : ViewModel() {

    // Repositories
    private val userRepository = UserRepository()

    // LiveData for nearby peers list
    private val _nearbyPeers = MutableLiveData<List<PeerWithMatchType>>()
    val nearbyPeers: LiveData<List<PeerWithMatchType>> get() = _nearbyPeers

    // LiveData for the current user
    private val _currentUser = MutableLiveData<User?>()
    val currentUser: LiveData<User?> get() = _currentUser

    // LiveData for loading state
    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> get() = _isLoading

    // LiveData for error messages
    private val _errorMessage = MutableLiveData<String?>()
    val errorMessage: LiveData<String?> get() = _errorMessage

    /**
     * Loads the current user's profile from Firestore.
     */
    fun loadCurrentUser() {
        viewModelScope.launch {
            _currentUser.value = userRepository.getCurrentUser()
        }
    }

    /**
     * Updates the user's location in Firestore.
     *
     * @param latitude Current latitude
     * @param longitude Current longitude
     */
    fun updateLocation(latitude: Double, longitude: Double) {
        val uid = userRepository.getCurrentUid() ?: return
        val roundedLat = LocationUtils.roundForPrivacy(latitude)
        val roundedLon = LocationUtils.roundForPrivacy(longitude)

        viewModelScope.launch {
            userRepository.updateLocation(uid, roundedLat, roundedLon)
        }
    }

    /**
     * Loads nearby peers based on the current user's location.
     * Determines if each peer is a perfect match, partial match,
     * or same college match.
     *
     * @param latitude Current latitude
     * @param longitude Current longitude
     */
    fun loadNearbyPeers(latitude: Double, longitude: Double) {
        _isLoading.value = true
        viewModelScope.launch {
            try {
                val user = userRepository.getCurrentUser()
                _currentUser.value = user

                if (user == null) {
                    _isLoading.value = false
                    return@launch
                }

                // Get bounding box for nearby query
                val box = LocationUtils.getBoundingBox(
                    latitude, longitude, Constants.MAX_DISTANCE_KM
                )

                // Query users within the bounding box
                val nearbyUsers = userRepository.getNearbyUsers(box.minLat, box.maxLat)

                // Filter by longitude (Firestore can only filter one range field)
                // and filter out the current user
                val filtered = nearbyUsers.filter { peer ->
                    peer.uid != user.uid &&
                    peer.longitude >= box.minLon &&
                    peer.longitude <= box.maxLon
                }

                // Determine match type for each peer
                val peersWithMatch = filtered.map { peer ->
                    val matchType = determineMatchType(user, peer)
                    val distance = LocationUtils.calculateDistanceKm(
                        latitude, longitude,
                        peer.latitude, peer.longitude
                    )
                    PeerWithMatchType(peer, matchType, distance)
                }

                // Sort by match type (perfect first) then by distance
                _nearbyPeers.value = peersWithMatch.sortedWith(
                    compareBy<PeerWithMatchType> { it.matchType.ordinal }
                        .thenBy { it.distanceKm }
                )

            } catch (e: Exception) {
                _errorMessage.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Determines the match type between the current user and a peer.
     *
     * @param currentUser The logged-in user
     * @param peer The nearby peer
     * @return MatchType enum value
     */
    private fun determineMatchType(currentUser: User, peer: User): MatchType {
        // Perfect match: peer teaches what I want to learn AND wants to learn what I teach
        val peerTeachesMyLearns = peer.teaches.any { it in currentUser.learns }
        val peerLearnsMyTeaches = peer.learns.any { it in currentUser.teaches }

        return when {
            peerTeachesMyLearns && peerLearnsMyTeaches -> MatchType.PERFECT
            peerTeachesMyLearns || peerLearnsMyTeaches -> MatchType.PARTIAL
            peer.college == currentUser.college -> MatchType.SAME_COLLEGE
            else -> MatchType.NONE
        }
    }
}

/**
 * Enum representing how well a peer matches with the current user.
 */
enum class MatchType {
    PERFECT,        // Mutual skill exchange possible
    PARTIAL,        // One-way skill match
    SAME_COLLEGE,   // Same institution but no skill overlap
    NONE            // No match criteria met
}

/**
 * Wrapper class combining a User with their match type and distance.
 * Used to display peer cards with match indicators.
 */
data class PeerWithMatchType(
    val user: User,
    val matchType: MatchType,
    val distanceKm: Double
)
