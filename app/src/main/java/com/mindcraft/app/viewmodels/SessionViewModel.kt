/**
 * SessionViewModel.kt — ViewModel for the Sessions screen
 *
 * Manages loading sessions by status, booking new sessions,
 * and rating completed sessions.
 */
package com.mindcraft.app.viewmodels

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mindcraft.app.model.Session
import com.mindcraft.app.repository.SessionRepository
import com.mindcraft.app.repository.UserRepository
import com.mindcraft.app.utils.Constants
import kotlinx.coroutines.launch

class SessionViewModel : ViewModel() {

    // Repositories
    private val sessionRepository = SessionRepository()
    private val userRepository = UserRepository()

    // LiveData for upcoming sessions
    private val _upcomingSessions = MutableLiveData<List<Session>>()
    val upcomingSessions: LiveData<List<Session>> get() = _upcomingSessions

    // LiveData for completed sessions
    private val _completedSessions = MutableLiveData<List<Session>>()
    val completedSessions: LiveData<List<Session>> get() = _completedSessions

    // LiveData for cancelled sessions
    private val _cancelledSessions = MutableLiveData<List<Session>>()
    val cancelledSessions: LiveData<List<Session>> get() = _cancelledSessions

    // Loading state
    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> get() = _isLoading

    // Action result for feedback
    private val _actionResult = MutableLiveData<String?>()
    val actionResult: LiveData<String?> get() = _actionResult

    /**
     * Loads all sessions for the current user, grouped by status.
     */
    fun loadAllSessions() {
        _isLoading.value = true
        viewModelScope.launch {
            val uid = userRepository.getCurrentUid() ?: return@launch

            _upcomingSessions.value = sessionRepository.getSessionsByStatus(uid, Constants.SESSION_UPCOMING)
            _completedSessions.value = sessionRepository.getSessionsByStatus(uid, Constants.SESSION_COMPLETED)
            _cancelledSessions.value = sessionRepository.getSessionsByStatus(uid, Constants.SESSION_CANCELLED)

            _isLoading.value = false
        }
    }

    /**
     * Books a new session.
     *
     * @param session The Session object to save
     */
    fun bookSession(session: Session) {
        _isLoading.value = true
        viewModelScope.launch {
            val success = sessionRepository.bookSession(session)
            _actionResult.value = if (success) "session_booked" else "error"
            _isLoading.value = false
        }
    }

    /**
     * Cancels an existing session.
     *
     * @param sessionId The ID of the session to cancel
     */
    fun cancelSession(sessionId: String) {
        viewModelScope.launch {
            val success = sessionRepository.cancelSession(sessionId)
            _actionResult.value = if (success) "session_cancelled" else "error"
            if (success) loadAllSessions()
        }
    }

    /**
     * Rates a completed session.
     *
     * @param sessionId The session to rate
     * @param rating Star rating (1-5)
     * @param comment Optional text comment
     * @param teacherUid The teacher's UID
     */
    fun rateSession(sessionId: String, rating: Float, comment: String, teacherUid: String) {
        viewModelScope.launch {
            val success = sessionRepository.rateSession(sessionId, rating, comment, teacherUid)
            _actionResult.value = if (success) "rating_submitted" else "error"
            if (success) loadAllSessions()
        }
    }

    /**
     * Resets the action result.
     */
    fun resetActionResult() {
        _actionResult.value = null
    }
}
