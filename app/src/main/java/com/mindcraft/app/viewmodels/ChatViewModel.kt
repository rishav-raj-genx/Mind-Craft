/**
 * ChatViewModel.kt — ViewModel for the Chat screen
 *
 * Manages real-time message listening, sending messages,
 * and chat thread display data.
 */
package com.mindcraft.app.viewmodels

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.ListenerRegistration
import com.mindcraft.app.model.Match
import com.mindcraft.app.model.Message
import com.mindcraft.app.repository.ChatRepository
import com.mindcraft.app.repository.MatchRepository
import com.mindcraft.app.repository.UserRepository
import kotlinx.coroutines.launch

class ChatViewModel : ViewModel() {

    // Repositories
    private val chatRepository = ChatRepository()
    private val matchRepository = MatchRepository()
    private val userRepository = UserRepository()

    // LiveData for messages in the current chat
    private val _messages = MutableLiveData<List<Message>>()
    val messages: LiveData<List<Message>> get() = _messages

    // LiveData for chat threads (matches with last message)
    private val _chatThreads = MutableLiveData<List<Match>>()
    val chatThreads: LiveData<List<Match>> get() = _chatThreads

    // Loading state
    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> get() = _isLoading

    // Message send result
    private val _messageSent = MutableLiveData<Boolean?>()
    val messageSent: LiveData<Boolean?> get() = _messageSent

    // Firestore listener registration (for cleanup)
    private var messageListener: ListenerRegistration? = null

    /**
     * Loads all chat threads (matches) for the current user.
     * Sorted by last message time.
     */
    fun loadChatThreads() {
        _isLoading.value = true
        viewModelScope.launch {
            val uid = userRepository.getCurrentUid() ?: return@launch
            val matches = matchRepository.getMyMatches(uid)
            _chatThreads.value = matches
            _isLoading.value = false
        }
    }

    /**
     * Starts listening for real-time messages in a chat thread.
     * This sets up a Firestore snapshot listener that automatically
     * updates whenever new messages arrive.
     *
     * @param matchId The match ID of the chat to listen to
     */
    fun startListeningForMessages(matchId: String) {
        // Remove any previous listener
        messageListener?.remove()

        // Set up new listener
        messageListener = chatRepository.listenForMessages(matchId) { messageList ->
            _messages.value = messageList
        }

        // Mark messages as read
        viewModelScope.launch {
            val uid = userRepository.getCurrentUid() ?: return@launch
            chatRepository.markMessagesAsRead(matchId, uid)
        }
    }

    /**
     * Sends a message in the current chat.
     *
     * @param matchId The match ID of the chat
     * @param text The message text to send
     */
    fun sendMessage(matchId: String, text: String) {
        val senderUid = userRepository.getCurrentUid() ?: return
        viewModelScope.launch {
            val success = chatRepository.sendMessage(matchId, senderUid, text)
            _messageSent.value = success
        }
    }

    /**
     * Gets the current user's UID.
     * Used to determine which messages are "mine" vs "theirs".
     */
    fun getCurrentUid(): String? {
        return userRepository.getCurrentUid()
    }

    /**
     * Cleanup: removes the Firestore listener when ViewModel is destroyed.
     */
    override fun onCleared() {
        super.onCleared()
        messageListener?.remove()
    }
}
