/**
 * ProfileSetupActivity.kt — Multi-step profile setup for new users
 *
 * This activity guides first-time users through 3 steps:
 * Step 1: Personal info (name, college, department, year)
 * Step 2: Skills they can teach (chip selection)
 * Step 3: Skills they want to learn (chip selection)
 *
 * After completing all steps, the profile is saved to Firestore.
 */
package com.mindcraft.app.activities

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModelProvider
import com.bumptech.glide.Glide
import com.google.android.material.chip.Chip
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessaging
import com.mindcraft.app.R
import com.mindcraft.app.databinding.ActivityProfileSetupBinding
import com.mindcraft.app.model.User
import com.mindcraft.app.utils.Constants
import com.mindcraft.app.utils.hide
import com.mindcraft.app.utils.show
import com.mindcraft.app.viewmodels.AuthViewModel

class ProfileSetupActivity : AppCompatActivity() {

    // View binding for accessing layout views
    private lateinit var binding: ActivityProfileSetupBinding

    // ViewModel for auth/profile operations
    private lateinit var authViewModel: AuthViewModel

    // Current step (0-indexed: 0, 1, 2)
    private var currentStep = 0

    // Selected skills lists
    private val selectedTeachSkills = mutableListOf<String>()
    private val selectedLearnSkills = mutableListOf<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityProfileSetupBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Initialize ViewModel
        authViewModel = ViewModelProvider(this)[AuthViewModel::class.java]

        // Pre-fill user info from Google account
        prefillGoogleInfo()

        // Set up year spinner
        setupYearSpinner()

        // Set up skill chips for Step 2 and Step 3
        setupSkillChips()

        // Set up button click listeners
        setupButtons()

        // Observe ViewModel
        observeViewModel()

        // Update the step UI
        updateStepUI()
    }

    /**
     * Pre-fills the name and profile photo from the Google account.
     */
    private fun prefillGoogleInfo() {
        val firebaseUser = FirebaseAuth.getInstance().currentUser
        firebaseUser?.let { user ->
            binding.etFullName.setText(user.displayName ?: "")

            // Load profile photo from Google
            user.photoUrl?.let { photoUrl ->
                Glide.with(this)
                    .load(photoUrl)
                    .placeholder(R.drawable.ic_placeholder_profile)
                    .circleCrop()
                    .into(binding.ivProfilePhoto)
            }
        }
    }

    /**
     * Sets up the year-of-study spinner with predefined options.
     */
    private fun setupYearSpinner() {
        val adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_item,
            Constants.YEAR_OPTIONS
        )
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.spinnerYear.adapter = adapter
    }

    /**
     * Creates chips for both the teach and learn chip groups.
     * Each chip represents a predefined skill that can be toggled.
     */
    private fun setupSkillChips() {
        // Create chips for Step 2 (Skills I Can Teach)
        for (skill in Constants.SKILLS_LIST) {
            addChipToGroup(skill, isTeachGroup = true)
        }

        // Create chips for Step 3 (Skills I Want to Learn)
        for (skill in Constants.SKILLS_LIST) {
            addChipToGroup(skill, isTeachGroup = false)
        }

        // Custom skill add buttons
        binding.btnAddSkillTeach.setOnClickListener {
            addCustomSkill(isTeachGroup = true)
        }

        binding.btnAddSkillLearn.setOnClickListener {
            addCustomSkill(isTeachGroup = false)
        }
    }

    /**
     * Adds a chip to the specified chip group (teach or learn).
     *
     * @param skillName The skill name for the chip
     * @param isTeachGroup true for teach group, false for learn group
     */
    private fun addChipToGroup(skillName: String, isTeachGroup: Boolean) {
        val chip = Chip(this).apply {
            text = skillName
            isCheckable = true
            isCheckedIconVisible = true

            // Set colors based on teach or learn
            if (isTeachGroup) {
                setChipBackgroundColorResource(R.color.chip_teach_bg)
                setTextColor(resources.getColor(R.color.chip_teach_text, theme))
            } else {
                setChipBackgroundColorResource(R.color.chip_learn_bg)
                setTextColor(resources.getColor(R.color.chip_learn_text, theme))
            }

            // Handle chip selection/deselection
            setOnCheckedChangeListener { _, isChecked ->
                handleChipSelection(skillName, isChecked, isTeachGroup)
            }
        }

        // Add to the correct chip group
        if (isTeachGroup) {
            binding.chipGroupTeach.addView(chip)
        } else {
            binding.chipGroupLearn.addView(chip)
        }
    }

    /**
     * Handles when a skill chip is selected or deselected.
     * Validates that the same skill isn't in both teach and learn lists.
     */
    private fun handleChipSelection(skill: String, isChecked: Boolean, isTeachGroup: Boolean) {
        if (isChecked) {
            // Check if the skill is already in the other list
            if (isTeachGroup && selectedLearnSkills.contains(skill)) {
                Toast.makeText(this, getString(R.string.skill_already_in_learn), Toast.LENGTH_SHORT).show()
                return
            }
            if (!isTeachGroup && selectedTeachSkills.contains(skill)) {
                Toast.makeText(this, getString(R.string.skill_already_in_teach), Toast.LENGTH_SHORT).show()
                return
            }

            // Add to the appropriate list
            if (isTeachGroup) selectedTeachSkills.add(skill)
            else selectedLearnSkills.add(skill)
        } else {
            // Remove from the appropriate list
            if (isTeachGroup) selectedTeachSkills.remove(skill)
            else selectedLearnSkills.remove(skill)
        }
    }

    /**
     * Adds a custom skill from the text input.
     */
    private fun addCustomSkill(isTeachGroup: Boolean) {
        val editText = if (isTeachGroup) binding.etCustomSkillTeach else binding.etCustomSkillLearn
        val skillName = editText.text.toString().trim()

        if (skillName.isNotEmpty()) {
            addChipToGroup(skillName, isTeachGroup)
            editText.text?.clear()
        }
    }

    /**
     * Sets up the Back and Next/Finish button click listeners.
     */
    private fun setupButtons() {
        binding.btnNext.setOnClickListener {
            handleNextButton()
        }

        binding.btnBack.setOnClickListener {
            handleBackButton()
        }
    }

    /**
     * Handles the Next/Finish button tap.
     * Validates the current step and moves forward.
     */
    private fun handleNextButton() {
        when (currentStep) {
            0 -> {
                // Validate Step 1 fields
                if (!validatePersonalInfo()) return
                currentStep = 1
                binding.viewFlipper.showNext()
            }
            1 -> {
                // Validate Step 2 (at least one teach skill)
                if (selectedTeachSkills.isEmpty()) {
                    Toast.makeText(this, getString(R.string.please_select_at_least_one_skill), Toast.LENGTH_SHORT).show()
                    return
                }
                currentStep = 2
                binding.viewFlipper.showNext()
            }
            2 -> {
                // Validate Step 3 (at least one learn skill)
                if (selectedLearnSkills.isEmpty()) {
                    Toast.makeText(this, getString(R.string.please_select_at_least_one_skill), Toast.LENGTH_SHORT).show()
                    return
                }
                currentStep = 3
                binding.viewFlipper.showNext()
            }
            3 -> {
                // Step 4: Coding profiles (optional) — save the profile
                saveProfile()
            }
        }
        updateStepUI()
    }

    /**
     * Handles the Back button tap.
     */
    private fun handleBackButton() {
        if (currentStep > 0) {
            currentStep--
            binding.viewFlipper.showPrevious()
            updateStepUI()
        }
    }

    /**
     * Updates the UI to reflect the current step
     * (progress bar, step text, button labels, back button visibility).
     */
    private fun updateStepUI() {
        // Update progress bar (1-indexed for display)
        binding.progressBarSetup.progress = currentStep + 1

        // Update step indicator text
        binding.tvStepIndicator.text = getString(R.string.step_format, currentStep + 1, 4)

        // Show/hide back button
        if (currentStep > 0) binding.btnBack.show() else binding.btnBack.hide()

        // Change next button text on last step
        binding.btnNext.text = if (currentStep == 3) {
            getString(R.string.finish_setup)
        } else {
            getString(R.string.next)
        }
    }

    /**
     * Validates Step 1 (Personal Info) fields.
     * Returns true if all fields are filled.
     */
    private fun validatePersonalInfo(): Boolean {
        val name = binding.etFullName.text.toString().trim()
        val college = binding.etCollege.text.toString().trim()
        val department = binding.etDepartment.text.toString().trim()

        if (name.isEmpty() || college.isEmpty() || department.isEmpty()) {
            Toast.makeText(this, getString(R.string.please_fill_all_fields), Toast.LENGTH_SHORT).show()
            return false
        }
        return true
    }

    /**
     * Saves the complete user profile to Firestore.
     * Gets the FCM token and creates the user document.
     */
    private fun saveProfile() {
        binding.progressBar.show()

        val firebaseUser = FirebaseAuth.getInstance().currentUser ?: return

        // Get FCM token for push notifications
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            val fcmToken = if (task.isSuccessful) task.result else ""

            // Build the User object with all profile data
            val user = User(
                uid = firebaseUser.uid,
                name = binding.etFullName.text.toString().trim(),
                email = firebaseUser.email ?: "",
                photoUrl = firebaseUser.photoUrl?.toString() ?: "",
                college = binding.etCollege.text.toString().trim(),
                department = binding.etDepartment.text.toString().trim(),
                year = binding.spinnerYear.selectedItem.toString(),
                teaches = selectedTeachSkills.toList(),
                learns = selectedLearnSkills.toList(),
                fcmToken = fcmToken,
                leetcodeUsername = binding.etLeetcodeUsername.text.toString().trim(),
                codeforcesUsername = binding.etCodeforcesUsername.text.toString().trim(),
                codechefUsername = binding.etCodechefUsername.text.toString().trim(),
                createdAt = System.currentTimeMillis()
            )

            // Save to Firestore via ViewModel
            authViewModel.saveUserProfile(user)
        }
    }

    /**
     * Observes ViewModel for profile save result.
     */
    private fun observeViewModel() {
        authViewModel.profileSaved.observe(this) { saved ->
            if (saved == null) return@observe
            binding.progressBar.hide()

            if (saved) {
                Toast.makeText(this, getString(R.string.profile_saved), Toast.LENGTH_SHORT).show()
                navigateToMain()
            } else {
                Toast.makeText(this, getString(R.string.error_saving_profile), Toast.LENGTH_SHORT).show()
            }
            authViewModel.resetStates()
        }
    }

    /**
     * Navigates to the main screen after profile setup.
     */
    private fun navigateToMain() {
        val intent = Intent(this, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}
