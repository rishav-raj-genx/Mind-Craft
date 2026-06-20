/**
 * ChatMessageAdapter.kt — RecyclerView adapter for chat messages
 *
 * Displays sent and received messages in the chat screen.
 * Sent messages show on the right in indigo bubbles.
 * Received messages show on the left in gray bubbles.
 */
package com.mindcraft.app.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.mindcraft.app.databinding.ChatMessageItemBinding
import com.mindcraft.app.model.Message
import com.mindcraft.app.utils.hide
import com.mindcraft.app.utils.show
import com.mindcraft.app.utils.toTimeString

class ChatMessageAdapter(
    private val currentUid: String
) : RecyclerView.Adapter<ChatMessageAdapter.MessageViewHolder>() {

    private var messages = listOf<Message>()

    fun submitList(newMessages: List<Message>) {
        messages = newMessages
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MessageViewHolder {
        val binding = ChatMessageItemBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return MessageViewHolder(binding)
    }

    override fun onBindViewHolder(holder: MessageViewHolder, position: Int) {
        holder.bind(messages[position])
    }

    override fun getItemCount(): Int = messages.size

    inner class MessageViewHolder(
        private val binding: ChatMessageItemBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(message: Message) {
            val isSentByMe = message.senderUid == currentUid

            if (isSentByMe) {
                // Show sent bubble, hide received
                binding.sentBubble.show()
                binding.receivedBubble.hide()
                binding.tvSentMessage.text = message.text
                binding.tvSentTime.text = message.timestamp.toTimeString()
            } else {
                // Show received bubble, hide sent
                binding.sentBubble.hide()
                binding.receivedBubble.show()
                binding.tvReceivedMessage.text = message.text
                binding.tvReceivedTime.text = message.timestamp.toTimeString()
            }
        }
    }
}
