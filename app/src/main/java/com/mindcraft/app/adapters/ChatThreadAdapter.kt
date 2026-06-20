/**
 * ChatThreadAdapter.kt — RecyclerView adapter for chat thread list
 *
 * Displays chat threads with peer name, last message, time, and unread count.
 */
package com.mindcraft.app.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.mindcraft.app.databinding.ChatThreadItemBinding
import com.mindcraft.app.model.Match
import com.mindcraft.app.utils.hide
import com.mindcraft.app.utils.show
import com.mindcraft.app.utils.toRelativeTimeString

class ChatThreadAdapter(
    private val onThreadClick: (Match) -> Unit
) : RecyclerView.Adapter<ChatThreadAdapter.ThreadViewHolder>() {

    private var threads = listOf<Match>()
    private var peerNames = mapOf<String, String>()
    private var peerPhotos = mapOf<String, String>()

    /**
     * Updates the thread list with peer info maps.
     */
    fun submitList(
        newThreads: List<Match>,
        names: Map<String, String>,
        photos: Map<String, String>
    ) {
        threads = newThreads
        peerNames = names
        peerPhotos = photos
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ThreadViewHolder {
        val binding = ChatThreadItemBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ThreadViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ThreadViewHolder, position: Int) {
        holder.bind(threads[position])
    }

    override fun getItemCount(): Int = threads.size

    inner class ThreadViewHolder(
        private val binding: ChatThreadItemBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(match: Match) {
            // Determine the correct peer UID
            val currentUid = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid ?: ""
            val peerUid = if (match.user1Uid == currentUid) match.user2Uid else match.user1Uid
            binding.tvThreadName.text = peerNames[peerUid] ?: peerUid
            binding.tvLastMessage.text = match.lastMessage.ifEmpty { "Start a conversation!" }
            binding.tvThreadTime.text = if (match.lastMessageTime > 0) {
                match.lastMessageTime.toRelativeTimeString()
            } else ""

            // Hide unread by default
            binding.tvUnreadCount.hide()

            binding.root.setOnClickListener { onThreadClick(match) }
        }
    }
}
