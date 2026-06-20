/**
 * MatchAdapter.kt — RecyclerView adapter for match cards
 *
 * Used across all three tabs in the Match screen:
 * Discover, Requests, and My Matches.
 * Different button actions are shown based on the tab context.
 */
package com.mindcraft.app.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.mindcraft.app.R
import com.mindcraft.app.databinding.MatchCardItemBinding
import com.mindcraft.app.model.User
import com.mindcraft.app.utils.hide
import com.mindcraft.app.utils.loadProfileImage
import com.mindcraft.app.utils.show

/**
 * Enum to define which tab context the adapter is being used in.
 * This changes the button labels and click actions.
 */
enum class MatchCardMode {
    DISCOVER,    // Shows "Connect" button
    REQUEST,     // Shows "Accept" and "Decline" buttons
    MY_MATCH     // Shows "Open Chat" button
}

class MatchAdapter(
    private val mode: MatchCardMode,
    private val onViewProfile: (User) -> Unit,
    private val onActionClick: (User, String) -> Unit
) : RecyclerView.Adapter<MatchAdapter.MatchViewHolder>() {

    // List of users to display
    private var users = listOf<User>()

    // Extra data map (request IDs for the Requests tab)
    private var extraData = mapOf<String, String>()

    /**
     * Updates the user list.
     */
    fun submitList(newUsers: List<User>, extra: Map<String, String> = emptyMap()) {
        users = newUsers
        extraData = extra
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MatchViewHolder {
        val binding = MatchCardItemBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return MatchViewHolder(binding)
    }

    override fun onBindViewHolder(holder: MatchViewHolder, position: Int) {
        holder.bind(users[position])
    }

    override fun getItemCount(): Int = users.size

    inner class MatchViewHolder(
        private val binding: MatchCardItemBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(user: User) {
            val context = binding.root.context

            // Load profile photo
            binding.ivMatchPhoto.loadProfileImage(user.photoUrl)

            // Set user info
            binding.tvMatchName.text = user.name
            binding.tvMatchCollege.text = user.college
            binding.tvMatchYear.text = user.year

            // Set skill badges
            val teachSkill = user.teaches.firstOrNull() ?: ""
            binding.tvTeachesYou.text = "${context.getString(R.string.teaches_you)} $teachSkill"

            val learnSkill = user.learns.firstOrNull() ?: ""
            binding.tvWantsFromYou.text = "${context.getString(R.string.wants_from_you)} $learnSkill"

            // Set rating
            binding.tvMatchRating.text = "★ ${String.format("%.1f", user.averageRating)}"

            // Configure buttons based on mode
            configureButtons(user)

            // View profile button
            binding.btnViewProfile.setOnClickListener {
                onViewProfile(user)
            }
        }

        /**
         * Configures the action buttons based on the tab context.
         */
        private fun configureButtons(user: User) {
            when (mode) {
                MatchCardMode.DISCOVER -> {
                    binding.btnConnect.text = binding.root.context.getString(R.string.connect)
                    binding.btnConnect.show()
                    binding.btnConnect.setOnClickListener {
                        val skill = user.teaches.firstOrNull() ?: ""
                        onActionClick(user, skill)
                    }
                }
                MatchCardMode.REQUEST -> {
                    binding.btnConnect.text = binding.root.context.getString(R.string.accept)
                    binding.btnConnect.show()
                    binding.btnViewProfile.text = binding.root.context.getString(R.string.decline)
                    binding.btnConnect.setOnClickListener {
                        onActionClick(user, "accept")
                    }
                    binding.btnViewProfile.setOnClickListener {
                        onActionClick(user, "decline")
                    }
                }
                MatchCardMode.MY_MATCH -> {
                    binding.btnConnect.text = binding.root.context.getString(R.string.open_chat)
                    binding.btnConnect.show()
                    binding.btnConnect.setOnClickListener {
                        onActionClick(user, "chat")
                    }
                }
            }
        }
    }
}
