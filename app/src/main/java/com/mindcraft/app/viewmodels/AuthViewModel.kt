/**
 * AuthViewModel.kt — ViewModel for authentication state
 *
 * Manages the login state and user session. Used by LoginActivity
 * and ProfileSetupActivity to handle auth-related logic.
 */
package com.mindcraft.app.viewmodels

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mindcraft.app.model.User
import com.mindcraft.app.repository.UserRepository
import kotlinx.coroutines.launch

class AuthViewModel : ViewModel() {

    // Repository for user operations
    private val userRepository = UserRepository()

    // LiveData to track whether the user profile exists in Firestore
    private val _userExists = MutableLiveData<Boolean?>()
    val userExists: LiveData<Boolean?> get() = _userExists

    // LiveData to track profile save success/failure
    private val _profileSaved = MutableLiveData<Boolean?>()
    val profileSaved: LiveData<Boolean?> get() = _profileSaved

    // LiveData for loading state
    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> get() = _isLoading

    // LiveData for error messages
    private val _errorMessage = MutableLiveData<String?>()
    val errorMessage: LiveData<String?> get() = _errorMessage

    /**
     * Checks if a user document exists in Firestore.
     * Called after successful Google Sign-In to determine
     * if the user needs to set up their profile.
     *
     * @param uid The Firebase Auth UID
     */
    fun checkUserExists(uid: String) {
        _isLoading.value = true
        viewModelScope.launch {
            val exists = userRepository.doesUserExist(uid)
            _userExists.value = exists
            _isLoading.value = false
        }
    }

    /**
     * Saves a new user profile to Firestore.
     * Called when the user completes the profile setup process.
     *
     * @param user The User object with all profile data
     */
    fun saveUserProfile(user: User) {
        _isLoading.value = true
        viewModelScope.launch {
            val success = userRepository.createUser(user)
            _profileSaved.value = success
            _isLoading.value = false
            if (!success) {
                _errorMessage.value = "Failed to save profile. Please try again."
            }
        }
    }

    /**
     * Resets observable states to prevent re-triggering on config changes.
     */
    fun resetStates() {
        _userExists.value = null
        _profileSaved.value = null
        _errorMessage.value = null
    }
}
