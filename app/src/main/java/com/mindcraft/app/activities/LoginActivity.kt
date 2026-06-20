/**
 * LoginActivity.kt — Google Sign-In screen
 *
 * Handles Google Sign-In flow and validates that the email belongs
 * to an educational institution (.edu, .ac.in, etc.).
 * New users are sent to ProfileSetupActivity; returning users go to MainActivity.
 */
package com.mindcraft.app.activities

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModelProvider
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.mindcraft.app.R
import com.mindcraft.app.databinding.ActivityLoginBinding
import com.mindcraft.app.utils.Constants
import com.mindcraft.app.utils.hide
import com.mindcraft.app.utils.show
import com.mindcraft.app.viewmodels.AuthViewModel

class LoginActivity : AppCompatActivity() {

    // View binding for accessing layout views
    private lateinit var binding: ActivityLoginBinding

    // ViewModel for auth operations
    private lateinit var authViewModel: AuthViewModel

    // Firebase Auth instance
    private lateinit var firebaseAuth: FirebaseAuth

    // Google Sign-In client
    private lateinit var googleSignInClient: GoogleSignInClient

    // Activity result launcher for Google Sign-In intent
    private val signInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        handleSignInResult(result.data)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Initialize Firebase Auth
        firebaseAuth = FirebaseAuth.getInstance()

        // Initialize ViewModel
        authViewModel = ViewModelProvider(this)[AuthViewModel::class.java]

        // Configure Google Sign-In
        setupGoogleSignIn()

        // Set up click listeners
        setupClickListeners()

        // Observe ViewModel states
        observeViewModel()
    }

    /**
     * Configures the Google Sign-In client with the default web client ID.
     */
    private fun setupGoogleSignIn() {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(getString(R.string.default_web_client_id))
            .requestEmail()
            .build()

        googleSignInClient = GoogleSignIn.getClient(this, gso)
    }

    /**
     * Sets up the click listener for the Google Sign-In button.
     */
    private fun setupClickListeners() {
        binding.btnGoogleSignIn.setOnClickListener {
            startGoogleSignIn()
        }
    }

    /**
     * Launches the Google Sign-In intent.
     */
    private fun startGoogleSignIn() {
        binding.progressBar.show()
        val signInIntent = googleSignInClient.signInIntent
        signInLauncher.launch(signInIntent)
    }

    /**
     * Handles the result from the Google Sign-In activity.
     * Extracts the ID token and authenticates with Firebase.
     */
    private fun handleSignInResult(data: Intent?) {
        try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            val account = task.getResult(ApiException::class.java)

            // Authenticate with Firebase using the Google ID token
            val idToken = account?.idToken
            if (idToken != null) {
                firebaseAuthWithGoogle(idToken)
            } else {
                binding.progressBar.hide()
                Toast.makeText(this, getString(R.string.login_failed), Toast.LENGTH_SHORT).show()
            }
        } catch (e: ApiException) {
            Log.d(Constants.LOG_TAG, "Google sign-in failed: ${e.message}")
            binding.progressBar.hide()
            Toast.makeText(this, getString(R.string.login_failed), Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Authenticates with Firebase using the Google ID token.
     */
    private fun firebaseAuthWithGoogle(idToken: String) {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        firebaseAuth.signInWithCredential(credential)
            .addOnCompleteListener(this) { task ->
                if (task.isSuccessful) {
                    val uid = firebaseAuth.currentUser?.uid ?: return@addOnCompleteListener
                    // Check if this user already has a profile in Firestore
                    authViewModel.checkUserExists(uid)
                } else {
                    binding.progressBar.hide()
                    Toast.makeText(this, getString(R.string.login_failed), Toast.LENGTH_SHORT).show()
                }
            }
    }

    /**
     * Checks if an email address belongs to an educational institution.
     * Validates against the list of known educational domains.
     *
     * @param email The email address to check
     * @return true if the email is from an educational institution
     */
    private fun isEducationalEmail(email: String): Boolean {
        val lowerEmail = email.lowercase()
        return Constants.EDU_DOMAINS.any { domain -> lowerEmail.endsWith(domain) }
    }

    /**
     * Shows an error dialog when the email is not from an educational institution.
     * Signs the user out after they dismiss the dialog.
     */
    private fun showEduEmailError() {
        binding.progressBar.hide()
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.edu_email_error_title))
            .setMessage(getString(R.string.edu_email_error_message))
            .setPositiveButton(getString(R.string.ok)) { dialog, _ ->
                dialog.dismiss()
                // Sign the user out since they don't have a valid edu email
                firebaseAuth.signOut()
                googleSignInClient.signOut()
            }
            .setCancelable(false)
            .show()
    }

    /**
     * Observes ViewModel LiveData for login state changes.
     */
    private fun observeViewModel() {
        // Observe whether the user profile exists in Firestore
        authViewModel.userExists.observe(this) { exists ->
            if (exists == null) return@observe
            binding.progressBar.hide()

            if (exists) {
                // Existing user — go to home screen
                navigateToMain()
            } else {
                // New user — go to profile setup
                navigateToProfileSetup()
            }
            authViewModel.resetStates()
        }
    }

    /**
     * Navigates to the main screen (home with bottom nav).
     */
    private fun navigateToMain() {
        val intent = Intent(this, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }

    /**
     * Navigates to the profile setup screen for first-time users.
     */
    private fun navigateToProfileSetup() {
        val intent = Intent(this, ProfileSetupActivity::class.java)
        startActivity(intent)
        finish()
    }
}
