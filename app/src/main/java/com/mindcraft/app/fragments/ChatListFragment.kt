/**
 * ChatListFragment.kt — Chat threads list screen
 *
 * Shows all active chat threads with peer info and last message preview.
 * Tapping a thread opens the individual ChatActivity.
 */
package com.mindcraft.app.fragments

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.mindcraft.app.activities.ChatActivity
import com.mindcraft.app.adapters.ChatThreadAdapter
import com.mindcraft.app.databinding.FragmentChatListBinding
import com.mindcraft.app.utils.hide
import com.mindcraft.app.utils.show
import com.mindcraft.app.viewmodels.ChatViewModel

class ChatListFragment : Fragment() {

    private var _binding: FragmentChatListBinding? = null
    private val binding get() = _binding!!

    private lateinit var chatViewModel: ChatViewModel
    private lateinit var threadAdapter: ChatThreadAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentChatListBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        chatViewModel = ViewModelProvider(this)[ChatViewModel::class.java]

        setupAdapter()
        observeViewModel()
        chatViewModel.loadChatThreads()
    }

    private fun setupAdapter() {
        threadAdapter = ChatThreadAdapter { match ->
            // Determine the peer UID (the other user in the match)
            val currentUid = chatViewModel.getCurrentUid() ?: return@ChatThreadAdapter
            val peerUid = if (match.user1Uid == currentUid) match.user2Uid else match.user1Uid

            val intent = Intent(requireContext(), ChatActivity::class.java)
            intent.putExtra("matchId", match.matchId)
            intent.putExtra("peerUid", peerUid)
            startActivity(intent)
        }

        binding.rvChatThreads.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = threadAdapter
        }
    }

    private fun observeViewModel() {
        chatViewModel.chatThreads.observe(viewLifecycleOwner) { threads ->
            if (threads.isEmpty()) {
                binding.emptyChatView.show()
                binding.rvChatThreads.hide()
            } else {
                binding.emptyChatView.hide()
                binding.rvChatThreads.show()
                threadAdapter.submitList(threads, emptyMap(), emptyMap())
            }
        }

        chatViewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            if (loading) binding.progressBar.show() else binding.progressBar.hide()
        }
    }

    override fun onResume() {
        super.onResume()
        chatViewModel.loadChatThreads()
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
