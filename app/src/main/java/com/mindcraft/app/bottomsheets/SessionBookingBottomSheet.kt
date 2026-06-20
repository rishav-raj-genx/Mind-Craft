/**
 * SessionBookingBottomSheet.kt — Modal bottom sheet for booking a session
 *
 * Allows users to select a skill, date, time, mode (online/in-person),
 * and optional notes before booking a session with their matched peer.
 */
package com.mindcraft.app.bottomsheets

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.lifecycle.ViewModelProvider
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.firebase.firestore.FirebaseFirestore
import com.mindcraft.app.R
import com.mindcraft.app.databinding.BottomSheetSessionBookingBinding
import com.mindcraft.app.model.Session
import com.mindcraft.app.repository.UserRepository
import com.mindcraft.app.utils.Constants
import com.mindcraft.app.utils.hide
import com.mindcraft.app.utils.show
import com.mindcraft.app.viewmodels.SessionViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.Calendar

class SessionBookingBottomSheet : BottomSheetDialogFragment() {

    private var _binding: BottomSheetSessionBookingBinding? = null
    private val binding get() = _binding!!

    private lateinit var sessionViewModel: SessionViewModel
    private var matchId = ""
    private var peerUid = ""

    // Selected date and time
    private var selectedCalendar = Calendar.getInstance()

    companion object {
        /**
         * Creates a new instance with match and peer data.
         */
        fun newInstance(matchId: String, peerUid: String): SessionBookingBottomSheet {
            return SessionBookingBottomSheet().apply {
                arguments = Bundle().apply {
                    putString("matchId", matchId)
                    putString("peerUid", peerUid)
                }
            }
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = BottomSheetSessionBookingBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        sessionViewModel = ViewModelProvider(this)[SessionViewModel::class.java]
        matchId = arguments?.getString("matchId") ?: ""
        peerUid = arguments?.getString("peerUid") ?: ""

        setupSkillSpinner()
        setupDateTimePickers()
        setupModeToggle()
        setupBookButton()
        observeViewModel()
    }

    /**
     * Loads shared skills between the two users for the spinner.
     */
    private fun setupSkillSpinner() {
        // Load shared skills from the match
        CoroutineScope(Dispatchers.Main).launch {
            val userRepo = UserRepository()
            val currentUser = userRepo.getCurrentUser()
            val peerUser = userRepo.getUser(peerUid)

            if (currentUser != null && peerUser != null) {
                // Find overlapping skills
                val shared = currentUser.teaches.intersect(peerUser.learns.toSet()) +
                        peerUser.teaches.intersect(currentUser.learns.toSet())
                val skillList = shared.toList().ifEmpty { listOf("General") }

                val adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, skillList)
                adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                binding.spinnerSkill.adapter = adapter
            }
        }
    }

    /**
     * Sets up date and time picker dialogs.
     */
    private fun setupDateTimePickers() {
        binding.btnSelectDate.setOnClickListener {
            DatePickerDialog(requireContext(), { _, year, month, day ->
                selectedCalendar.set(year, month, day)
                binding.btnSelectDate.text = "$day/${month + 1}/$year"
            },
                selectedCalendar.get(Calendar.YEAR),
                selectedCalendar.get(Calendar.MONTH),
                selectedCalendar.get(Calendar.DAY_OF_MONTH)
            ).show()
        }

        binding.btnSelectTime.setOnClickListener {
            TimePickerDialog(requireContext(), { _, hour, minute ->
                selectedCalendar.set(Calendar.HOUR_OF_DAY, hour)
                selectedCalendar.set(Calendar.MINUTE, minute)
                binding.btnSelectTime.text = String.format("%02d:%02d", hour, minute)
            },
                selectedCalendar.get(Calendar.HOUR_OF_DAY),
                selectedCalendar.get(Calendar.MINUTE),
                false
            ).show()
        }
    }

    /**
     * Shows/hides the location field based on Online/In-Person selection.
     */
    private fun setupModeToggle() {
        binding.radioGroupMode.setOnCheckedChangeListener { _, checkedId ->
            if (checkedId == R.id.rbInPerson) {
                binding.tilLocation.show()
            } else {
                binding.tilLocation.hide()
            }
        }
    }

    /**
     * Handles the "Book Session" button click.
     */
    private fun setupBookButton() {
        binding.btnBookSession.setOnClickListener {
            val skill = binding.spinnerSkill.selectedItem?.toString() ?: ""
            val mode = if (binding.rbOnline.isChecked) Constants.MODE_ONLINE else Constants.MODE_IN_PERSON
            val location = binding.etLocation.text.toString().trim()
            val notes = binding.etNotes.text.toString().trim()

            // Generate meet link for online sessions
            val meetLink = if (mode == Constants.MODE_ONLINE) {
                val chars = "abcdefghijklmnopqrstuvwxyz0123456789"
                val random = (1..6).map { chars.random() }.joinToString("")
                "meet.google.com/mindcraft-$random"
            } else ""

            // Validate required fields
            if (skill.isEmpty()) {
                Toast.makeText(requireContext(), getString(R.string.please_fill_required), Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val currentUid = UserRepository().getCurrentUid() ?: return@setOnClickListener
            val sessionId = FirebaseFirestore.getInstance().collection(Constants.COLLECTION_SESSIONS).document().id

            val session = Session(
                sessionId = sessionId,
                matchId = matchId,
                teacherUid = peerUid,
                learnerUid = currentUid,
                skill = skill,
                scheduledAt = selectedCalendar.timeInMillis,
                mode = mode,
                meetLink = meetLink,
                location = location,
                notes = notes,
                status = Constants.SESSION_UPCOMING,
                createdAt = System.currentTimeMillis()
            )

            binding.progressBar.show()
            sessionViewModel.bookSession(session)
        }
    }

    private fun observeViewModel() {
        sessionViewModel.actionResult.observe(viewLifecycleOwner) { result ->
            binding.progressBar.hide()
            when (result) {
                "session_booked" -> {
                    Toast.makeText(requireContext(), getString(R.string.session_booked), Toast.LENGTH_SHORT).show()
                    dismiss()
                }
                "error" -> Toast.makeText(requireContext(), getString(R.string.error_occurred), Toast.LENGTH_SHORT).show()
            }
            sessionViewModel.resetActionResult()
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
