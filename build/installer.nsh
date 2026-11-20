; The app's window can be unresponsive while a portable copy runs from a
; restricted drive, and Windows then refuses to release resources\app.asar.
; End every MengBot/AutoBot process before the installer touches the install folder.
!macro customInit
  nsExec::Exec 'cmd /c taskkill /F /IM MengBot.exe /T'
  Sleep 800
!macroend
