/**
 * SessionCardAdapter.kt — RecyclerView adapter for session cards
 *
 * Displays session details in the Sessions tab.
 * Shows different action buttons based on session status.
 */
package com.mindcraft.app.adapters

import android.content.Intent
import android.net.Uri
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.mindcraft.app.R
import com.mindcraft.app.databinding.SessionCardItemBinding
import com.mindcraft.app.model.Session
import com.mindcraft.app.utils.Constants
import com.mindcraft.app.utils.hide
import com.mindcraft.app.utils.show
import com.mindcraft.app.utils.toDateTimeString

class SessionCardAdapter(
    private val onRateClick: ((Session) -> Unit)? = null,
    private val onCancelClick: ((Session) -> Unit)? = null
) : RecyclerView.Adapter<SessionCardAdapter.SessionViewHolder>() {

    private var sessions = listOf<Session>()

    fun submitList(newSessions: List<Session>) {
        sessions = newSessions
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SessionViewHolder {
        val binding = SessionCardItemBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return SessionViewHolder(binding)
    }

    override fun onBindViewHolder(holder: SessionViewHolder, position: Int) {
        holder.bind(sessions[position])
    }

    override fun getItemCount(): Int = sessions.size

    inner class SessionViewHolder(
        private val binding: SessionCardItemBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(session: Session) {
            val context = binding.root.context

            binding.tvSessionSkill.text = session.skill
            binding.tvSessionDateTime.text = session.scheduledAt.toDateTimeString()
            binding.tvSessionMode.text = session.mode
            binding.tvSessionStatus.text = session.status

            // Show meet link for online sessions
            if (session.mode == Constants.MODE_ONLINE && session.meetLink.isNotEmpty()) {
                binding.tvMeetLink.text = session.meetLink
                binding.tvMeetLink.show()
                binding.tvMeetLink.setOnClickListener {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://${session.meetLink}"))
                    context.startActivity(intent)
                }
            } else {
                binding.tvMeetLink.hide()
            }

            // Show action button based on status
            when (session.status) {
                Constants.SESSION_UPCOMING -> {
                    binding.btnSessionAction.text = context.getString(R.string.cancel_session)
                    binding.btnSessionAction.show()
                    binding.btnSessionAction.setOnClickListener { onCancelClick?.invoke(session) }
                }
                Constants.SESSION_COMPLETED -> {
                    if (session.rating == 0f) {
                        binding.btnSessionAction.text = context.getString(R.string.rate_session)
                        binding.btnSessionAction.show()
                        binding.btnSessionAction.setOnClickListener { onRateClick?.invoke(session) }
                    } else {
                        binding.btnSessionAction.hide()
                    }
                }
                else -> binding.btnSessionAction.hide()
            }
        }
    }
}
