# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in the SDK tools proguard-defaults.txt

# Keep Firebase models and their fields for serialization
-keep class com.mindcraft.app.model.** { *; }
-keepclassmembers class com.mindcraft.app.model.** { *; }

# Keep Glide generated API
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep class * extends com.bumptech.glide.module.AppGlideModule { <init>(...); }

# Keep Material components
-keep class com.google.android.material.** { *; }
