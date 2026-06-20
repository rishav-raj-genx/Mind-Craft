/**
 * CodingProfileFragment.kt — Coding Profile section
 *
 * Replaces the Sessions tab. Displays the current user's
 * coding platform usernames (LeetCode, Codeforces, CodeChef)
 * and allows opening external profile links.
 */
package com.mindcraft.app.fragments

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.mindcraft.app.R
import com.mindcraft.app.databinding.FragmentCodingProfileBinding
import com.mindcraft.app.repository.UserRepository
import com.mindcraft.app.utils.hide
import com.mindcraft.app.utils.show
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class CodingProfileFragment : Fragment() {

    private var _binding: FragmentCodingProfileBinding? = null
    private val binding get() = _binding!!

    private val userRepository = UserRepository()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentCodingProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadCodingProfile()
        setupClickListeners()
    }

    /**
     * Loads the current user's coding platform usernames from Firestore.
     */
    private fun loadCodingProfile() {
        binding.progressBar.show()
        CoroutineScope(Dispatchers.Main).launch {
            val user = userRepository.getCurrentUser()
            binding.progressBar.hide()

            if (user != null) {
                binding.tvLeetcodeUsername.text =
                    if (user.leetcodeUsername.isNotEmpty()) user.leetcodeUsername
                    else getString(R.string.not_linked)

                binding.tvCodeforcesUsername.text =
                    if (user.codeforcesUsername.isNotEmpty()) user.codeforcesUsername
                    else getString(R.string.not_linked)

                binding.tvCodechefUsername.text =
                    if (user.codechefUsername.isNotEmpty()) user.codechefUsername
                    else getString(R.string.not_linked)
            }
        }
    }

    /**
     * Sets up click listeners for external links and edit button.
     */
    private fun setupClickListeners() {
        binding.btnLeetcodeLink.setOnClickListener {
            val username = binding.tvLeetcodeUsername.text.toString()
            if (username != getString(R.string.not_linked) && username.isNotEmpty()) {
                openUrl("https://leetcode.com/$username")
            }
        }

        binding.btnCodeforcesLink.setOnClickListener {
            val username = binding.tvCodeforcesUsername.text.toString()
            if (username != getString(R.string.not_linked) && username.isNotEmpty()) {
                openUrl("https://codeforces.com/profile/$username")
            }
        }

        binding.btnCodechefLink.setOnClickListener {
            val username = binding.tvCodechefUsername.text.toString()
            if (username != getString(R.string.not_linked) && username.isNotEmpty()) {
                openUrl("https://www.codechef.com/users/$username")
            }
        }

        binding.btnEditCodingProfile.setOnClickListener {
            Toast.makeText(requireContext(), "Edit in My Profile", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Opens an external URL in the browser.
     */
    private fun openUrl(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(requireContext(), getString(R.string.error_occurred), Toast.LENGTH_SHORT).show()
        }
    }

    override fun onResume() {
        super.onResume()
        loadCodingProfile()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
