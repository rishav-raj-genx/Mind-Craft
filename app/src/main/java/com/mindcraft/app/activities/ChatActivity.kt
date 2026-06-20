/**
 * ChatActivity.kt — Individual chat screen with real-time messaging
 *
 * Displays messages in real-time using Firestore snapshot listeners.
 * Users can send messages and book sessions from this screen.
 */
package com.mindcraft.app.activities

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.mindcraft.app.R
import com.mindcraft.app.adapters.ChatMessageAdapter
import com.mindcraft.app.bottomsheets.SessionBookingBottomSheet
import com.mindcraft.app.databinding.ActivityChatBinding
import com.mindcraft.app.repository.MatchRepository
import com.mindcraft.app.repository.UserRepository
import com.mindcraft.app.utils.loadProfileImage
import com.mindcraft.app.viewmodels.ChatViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ChatActivity : AppCompatActivity() {

    private lateinit var binding: ActivityChatBinding
    private lateinit var chatViewModel: ChatViewModel
    private lateinit var messageAdapter: ChatMessageAdapter

    // Match ID and peer UID passed from the previous screen
    private var matchId: String = ""
    private var peerUid: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityChatBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Get data from intent
        matchId = intent.getStringExtra("matchId") ?: ""
        peerUid = intent.getStringExtra("peerUid") ?: ""

        // Initialize ViewModel
        chatViewModel = ViewModelProvider(this)[ChatViewModel::class.java]

        // Set up UI
        setupPeerInfo()
        setupMessageList()
        setupSendButton()
        setupBookSessionButton()
        setupBackButton()

        // Observe messages
        observeMessages()

        // Start listening — if matchId is empty, look it up first
        if (matchId.isNotEmpty()) {
            chatViewModel.startListeningForMessages(matchId)
        } else if (peerUid.isNotEmpty()) {
            // FIX: Look up matchId from Firestore using both UIDs
            lookupMatchId()
        }
    }

    /**
     * Looks up the matchId when it wasn't passed via intent.
     * This handles cases where the chat is opened from MatchFragment or PeerProfile
     * without the matchId being available.
     */
    private fun lookupMatchId() {
        val currentUid = chatViewModel.getCurrentUid() ?: return
        CoroutineScope(Dispatchers.Main).launch {
            val matchRepo = MatchRepository()
            val foundMatchId = matchRepo.findMatchId(currentUid, peerUid)
            if (foundMatchId != null) {
                matchId = foundMatchId
                chatViewModel.startListeningForMessages(matchId)
            } else {
                Toast.makeText(this@ChatActivity, getString(R.string.error_occurred), Toast.LENGTH_SHORT).show()
            }
        }
    }

    /**
     * Loads the peer's profile info for the top bar.
     */
    private fun setupPeerInfo() {
        if (peerUid.isEmpty()) return
        CoroutineScope(Dispatchers.Main).launch {
            val userRepo = UserRepository()
            val peer = userRepo.getUser(peerUid)
            peer?.let {
                binding.tvChatPeerName.text = it.name
                binding.ivChatPeerPhoto.loadProfileImage(it.photoUrl)
            }
        }
    }

    /**
     * Sets up the RecyclerView with the ChatMessageAdapter.
     */
    private fun setupMessageList() {
        val currentUid = chatViewModel.getCurrentUid() ?: ""
        messageAdapter = ChatMessageAdapter(currentUid)

        binding.rvMessages.apply {
            layoutManager = LinearLayoutManager(this@ChatActivity).apply {
                stackFromEnd = true  // Show newest messages at the bottom
            }
            adapter = messageAdapter
        }
    }

    /**
     * Sets up the send button click listener.
     */
    private fun setupSendButton() {
        binding.btnSend.setOnClickListener {
            val text = binding.etMessage.text.toString().trim()
            if (text.isNotEmpty() && matchId.isNotEmpty()) {
                chatViewModel.sendMessage(matchId, text)
                binding.etMessage.text?.clear()
            }
        }
    }

    /**
     * Sets up the "Book Session" button in the top bar.
     */
    private fun setupBookSessionButton() {
        binding.btnBookSession.setOnClickListener {
            if (matchId.isNotEmpty()) {
                val bottomSheet = SessionBookingBottomSheet.newInstance(matchId, peerUid)
                bottomSheet.show(supportFragmentManager, "session_booking")
            }
        }
    }

    /**
     * Sets up the back button.
     */
    private fun setupBackButton() {
        binding.btnBack.setOnClickListener { finish() }
    }

    /**
     * Observes real-time messages from the ViewModel.
     */
    private fun observeMessages() {
        chatViewModel.messages.observe(this) { messages ->
            messageAdapter.submitList(messages)
            // Scroll to the newest message
            if (messages.isNotEmpty()) {
                binding.rvMessages.scrollToPosition(messages.size - 1)
            }
        }
    }
}
