/**
 * PeerCardAdapter.kt — RecyclerView adapter for peer cards
 *
 * Displays nearby peers in the bottom sheet on the home screen.
 * Each card shows the peer's photo, name, college, skills, distance, and rating.
 */
package com.mindcraft.app.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.mindcraft.app.R
import com.mindcraft.app.databinding.PeerCardItemBinding
import com.mindcraft.app.utils.LocationUtils
import com.mindcraft.app.utils.loadProfileImage
import com.mindcraft.app.viewmodels.PeerWithMatchType

class PeerCardAdapter(
    // Click listener for when a peer card is tapped
    private val onPeerClick: (PeerWithMatchType) -> Unit
) : RecyclerView.Adapter<PeerCardAdapter.PeerViewHolder>() {

    // List of peers to display
    private var peers = listOf<PeerWithMatchType>()

    /**
     * Updates the list of peers and refreshes the RecyclerView.
     *
     * @param newPeers The new list of peers to display
     */
    fun submitList(newPeers: List<PeerWithMatchType>) {
        peers = newPeers
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PeerViewHolder {
        val binding = PeerCardItemBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return PeerViewHolder(binding)
    }

    override fun onBindViewHolder(holder: PeerViewHolder, position: Int) {
        holder.bind(peers[position])
    }

    override fun getItemCount(): Int = peers.size

    /**
     * ViewHolder for a single peer card.
     */
    inner class PeerViewHolder(
        private val binding: PeerCardItemBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        /**
         * Binds peer data to the card views.
         */
        fun bind(peerWithMatch: PeerWithMatchType) {
            val peer = peerWithMatch.user
            val context = binding.root.context

            // Load profile photo
            binding.ivPeerPhoto.loadProfileImage(peer.photoUrl)

            // Set name and college
            binding.tvPeerName.text = peer.name
            binding.tvPeerCollege.text = peer.college

            // Set skill badges
            val teachSkill = peer.teaches.firstOrNull() ?: ""
            binding.tvTeaches.text = context.getString(R.string.teaches_label, teachSkill)

            val wantSkill = peer.learns.firstOrNull() ?: ""
            binding.tvWants.text = context.getString(R.string.wants_label, wantSkill)

            // Set distance
            val distanceStr = LocationUtils.formatDistance(peerWithMatch.distanceKm)
            binding.tvDistance.text = context.getString(R.string.km_away, distanceStr)

            // Set rating
            binding.tvRating.text = String.format("%.1f", peer.averageRating)

            // Set click listener
            binding.root.setOnClickListener {
                onPeerClick(peerWithMatch)
            }
        }
    }
}
