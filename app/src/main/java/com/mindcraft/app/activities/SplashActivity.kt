/**
 * SplashActivity.kt — Splash screen shown when the app launches
 *
 * Displays the Mind Craft logo and tagline for 2 seconds, then:
 * - If the user is already logged in → navigate to MainActivity
 * - If not logged in → navigate to LoginActivity
 */
package com.mindcraft.app.activities

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.FirebaseAuth
import com.mindcraft.app.R
import com.mindcraft.app.repository.UserRepository
import com.mindcraft.app.utils.Constants
import com.mindcraft.app.utils.NotificationUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class SplashActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        // Create the notification channel (required once for Android 8+)
        NotificationUtils.createNotificationChannel(this)

        // Wait 2 seconds, then check login state and navigate
        Handler(Looper.getMainLooper()).postDelayed({
            checkLoginAndNavigate()
        }, Constants.SPLASH_DELAY_MS)
    }

    /**
     * Checks if the user is already logged in with Firebase Auth.
     * Navigates to the appropriate screen based on login state.
     */
    private fun checkLoginAndNavigate() {
        val currentUser = FirebaseAuth.getInstance().currentUser

        if (currentUser != null) {
            // User is logged in — check if they have a profile
            CoroutineScope(Dispatchers.Main).launch {
                val exists = UserRepository().doesUserExist(currentUser.uid)
                if (exists) {
                    navigateToMain()
                } else {
                    navigateToProfileSetup()
                }
            }
        } else {
            // User is not logged in — go to the login screen
            navigateToLogin()
        }
    }

    /**
     * Navigates to MainActivity (home screen with bottom navigation).
     */
    private fun navigateToMain() {
        val intent = Intent(this, MainActivity::class.java)
        startActivity(intent)
        finish() // Prevent going back to splash
    }

    /**
     * Navigates to LoginActivity (Google Sign-In screen).
     */
    private fun navigateToLogin() {
        val intent = Intent(this, LoginActivity::class.java)
        startActivity(intent)
        finish() // Prevent going back to splash
    }

    /**
     * Navigates to ProfileSetupActivity for first-time profile creation.
     */
    private fun navigateToProfileSetup() {
        val intent = Intent(this, ProfileSetupActivity::class.java)
        startActivity(intent)
        finish()
    }
}
