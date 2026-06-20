/**
 * MyProfileActivity.kt — Current user's profile screen
 *
 * Shows the logged-in user's profile with stats, skill chips,
 * and the ability to edit and save changes.
 * Also provides logout functionality.
 */
package com.mindcraft.app.activities

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.chip.Chip
import com.google.firebase.auth.FirebaseAuth
import com.mindcraft.app.R
import com.mindcraft.app.databinding.ActivityMyProfileBinding
import com.mindcraft.app.repository.UserRepository
import com.mindcraft.app.utils.hide
import com.mindcraft.app.utils.loadProfileImage
import com.mindcraft.app.utils.show
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MyProfileActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMyProfileBinding
    private val userRepository = UserRepository()
    private var isEditMode = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMyProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnBack.setOnClickListener { finish() }
        binding.btnEdit.setOnClickListener { toggleEditMode() }
        binding.btnLogout.setOnClickListener { showLogoutDialog() }
        binding.btnSave.setOnClickListener { saveChanges() }

        loadProfile()
    }

    /**
     * Loads the current user's profile from Firestore.
     */
    private fun loadProfile() {
        binding.progressBar.show()
        CoroutineScope(Dispatchers.Main).launch {
            val user = userRepository.getCurrentUser()
            binding.progressBar.hide()

            if (user == null) {
                Toast.makeText(this@MyProfileActivity, getString(R.string.error_occurred), Toast.LENGTH_SHORT).show()
                return@launch
            }

            // Populate UI
            binding.ivMyPhoto.loadProfileImage(user.photoUrl)
            binding.tvMyName.text = user.name
            binding.tvMyEmail.text = user.email
            binding.etCollege.setText(user.college)
            binding.etDepartment.setText(user.department)
            binding.tvStatSessions.text = user.totalSessions.toString()
            binding.tvStatRating.text = String.format("%.1f", user.averageRating)

            // Add teach skill chips
            user.teaches.forEach { skill ->
                val chip = Chip(this@MyProfileActivity).apply {
                    text = skill
                    setChipBackgroundColorResource(R.color.chip_teach_bg)
                    setTextColor(resources.getColor(R.color.chip_teach_text, theme))
                }
                binding.chipGroupTeach.addView(chip)
            }

            // Add learn skill chips
            user.learns.forEach { skill ->
                val chip = Chip(this@MyProfileActivity).apply {
                    text = skill
                    setChipBackgroundColorResource(R.color.chip_learn_bg)
                    setTextColor(resources.getColor(R.color.chip_learn_text, theme))
                }
                binding.chipGroupLearn.addView(chip)
            }
        }
    }

    /**
     * Toggles between view and edit mode.
     */
    private fun toggleEditMode() {
        isEditMode = !isEditMode
        binding.etCollege.isEnabled = isEditMode
        binding.etDepartment.isEnabled = isEditMode

        if (isEditMode) {
            binding.btnSave.show()
            binding.btnEdit.text = getString(R.string.cancel)
        } else {
            binding.btnSave.hide()
            binding.btnEdit.text = getString(R.string.edit_profile)
        }
    }

    /**
     * Saves profile changes to Firestore.
     */
    private fun saveChanges() {
        val uid = userRepository.getCurrentUid() ?: return
        val updates = mapOf(
            "college" to binding.etCollege.text.toString().trim(),
            "department" to binding.etDepartment.text.toString().trim()
        )

        binding.progressBar.show()
        CoroutineScope(Dispatchers.Main).launch {
            val success = userRepository.updateProfile(uid, updates)
            binding.progressBar.hide()

            if (success) {
                Toast.makeText(this@MyProfileActivity, getString(R.string.profile_updated), Toast.LENGTH_SHORT).show()
                toggleEditMode()
            } else {
                Toast.makeText(this@MyProfileActivity, getString(R.string.error_occurred), Toast.LENGTH_SHORT).show()
            }
        }
    }

    /**
     * Shows a confirmation dialog before logging out.
     */
    private fun showLogoutDialog() {
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.logout))
            .setMessage(getString(R.string.logout_confirm))
            .setPositiveButton(getString(R.string.logout)) { _, _ ->
                performLogout()
            }
            .setNegativeButton(getString(R.string.cancel), null)
            .show()
    }

    /**
     * Logs the user out and navigates to the login screen.
     */
    private fun performLogout() {
        FirebaseAuth.getInstance().signOut()
        val intent = Intent(this, LoginActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}
