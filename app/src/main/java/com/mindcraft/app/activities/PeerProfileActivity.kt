/**
 * PeerProfileActivity.kt — Full profile view of another user
 *
 * Shows their profile photo, name, college, skills, ratings, and reviews.
 * Has a "Connect" button or "Open Chat" button based on match status.
 */
package com.mindcraft.app.activities

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.chip.Chip
import com.mindcraft.app.R
import com.mindcraft.app.databinding.ActivityPeerProfileBinding
import com.mindcraft.app.repository.MatchRepository
import com.mindcraft.app.repository.UserRepository
import com.mindcraft.app.utils.Constants
import com.mindcraft.app.utils.hide
import com.mindcraft.app.utils.loadProfileImage
import com.mindcraft.app.utils.show
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class PeerProfileActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPeerProfileBinding
    private val userRepository = UserRepository()
    private val matchRepository = MatchRepository()
    private var peerUid = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPeerProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)

        peerUid = intent.getStringExtra("peerUid") ?: ""
        binding.btnBack.setOnClickListener { finish() }

        loadPeerProfile()
    }

    /**
     * Loads the peer's profile data from Firestore.
     */
    private fun loadPeerProfile() {
        binding.progressBar.show()
        CoroutineScope(Dispatchers.Main).launch {
            val peer = userRepository.getUser(peerUid)
            binding.progressBar.hide()

            if (peer == null) {
                Toast.makeText(this@PeerProfileActivity, getString(R.string.error_occurred), Toast.LENGTH_SHORT).show()
                finish()
                return@launch
            }

            // Populate UI
            binding.ivPeerPhoto.loadProfileImage(peer.photoUrl)
            binding.tvPeerName.text = peer.name
            binding.tvPeerCollege.text = peer.college
            binding.tvPeerDeptYear.text = "${peer.department} • ${peer.year}"
            binding.tvPeerRating.text = "★ ${String.format("%.1f", peer.averageRating)}"
            binding.tvPeerSessions.text = getString(R.string.total_sessions) + ": ${peer.totalSessions}"

            // Add teach skill chips (green)
            peer.teaches.forEach { skill ->
                val chip = Chip(this@PeerProfileActivity).apply {
                    text = skill
                    setChipBackgroundColorResource(R.color.chip_teach_bg)
                    setTextColor(resources.getColor(R.color.chip_teach_text, theme))
                }
                binding.chipGroupTeach.addView(chip)
            }

            // Add learn skill chips (indigo)
            peer.learns.forEach { skill ->
                val chip = Chip(this@PeerProfileActivity).apply {
                    text = skill
                    setChipBackgroundColorResource(R.color.chip_learn_bg)
                    setTextColor(resources.getColor(R.color.chip_learn_text, theme))
                }
                binding.chipGroupLearn.addView(chip)
            }

            // Display coding profiles
            binding.tvPeerLeetcode.text = if (peer.leetcodeUsername.isNotEmpty())
                "LeetCode: ${peer.leetcodeUsername}" else "LeetCode: —"
            binding.tvPeerCodeforces.text = if (peer.codeforcesUsername.isNotEmpty())
                "Codeforces: ${peer.codeforcesUsername}" else "Codeforces: —"
            binding.tvPeerCodechef.text = if (peer.codechefUsername.isNotEmpty())
                "CodeChef: ${peer.codechefUsername}" else "CodeChef: —"

            // Check if already matched
            setupActionButton()
        }
    }

    /**
     * Configures the action button based on match status.
     */
    private fun setupActionButton() {
        val currentUid = userRepository.getCurrentUid() ?: return

        CoroutineScope(Dispatchers.Main).launch {
            val isMatched = matchRepository.areMatched(currentUid, peerUid)

            if (isMatched) {
                binding.btnAction.text = getString(R.string.open_chat)
                binding.btnAction.setOnClickListener {
                    // Look up the matchId before opening chat
                    CoroutineScope(Dispatchers.Main).launch {
                        val matchId = matchRepository.findMatchId(currentUid, peerUid)
                        val intent = Intent(this@PeerProfileActivity, ChatActivity::class.java)
                        intent.putExtra("peerUid", peerUid)
                        intent.putExtra("matchId", matchId ?: "")
                        startActivity(intent)
                    }
                }
            } else {
                binding.btnAction.text = getString(R.string.connect)
                binding.btnAction.setOnClickListener {
                    sendMatchRequest()
                }
            }
        }
    }

    /**
     * Sends a match request to this peer.
     */
    private fun sendMatchRequest() {
        val currentUid = userRepository.getCurrentUid() ?: return

        CoroutineScope(Dispatchers.Main).launch {
            val currentUser = userRepository.getCurrentUser() ?: return@launch
            val sharedSkill = currentUser.learns.firstOrNull() ?: ""
            val success = matchRepository.sendMatchRequest(currentUid, peerUid, sharedSkill)

            if (success) {
                Toast.makeText(this@PeerProfileActivity, getString(R.string.match_request_sent), Toast.LENGTH_SHORT).show()
                binding.btnAction.isEnabled = false
                binding.btnAction.text = getString(R.string.requests)
            } else {
                Toast.makeText(this@PeerProfileActivity, getString(R.string.error_occurred), Toast.LENGTH_SHORT).show()
            }
        }
    }
}
