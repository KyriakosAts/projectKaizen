package com.dojopatras.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // No enableEdgeToEdge(): drawing behind the system bars turns off the
    // manifest's adjustResize, so the on-screen keyboard covered inputs and
    // buttons instead of shrinking the page
    super.onCreate(savedInstanceState)

    // Pre-scoped-storage devices (API <= 28): ask once for classic external
    // storage so backups and exports live in public Documents and
    // survive an uninstall. Denial is fine — Rust falls back to the sandbox.
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P &&
      ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
        != PackageManager.PERMISSION_GRANTED
    ) {
      ActivityCompat.requestPermissions(
        this,
        arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE),
        1001
      )
    }
  }
}
