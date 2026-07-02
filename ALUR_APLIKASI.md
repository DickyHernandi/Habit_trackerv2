# Alur Aplikasi Habit Tracker

Dokumen ini menjelaskan alur utama aplikasi secara ringkas agar mudah dipahami.

## 1. Alur Login dan Register
- Pengguna membuka aplikasi dan masuk ke proses autentikasi.
- Saat register, frontend mengirim data username dan password ke backend.
- Backend memvalidasi input, mengenkripsi password, lalu menyimpan data user ke Firestore.
- Backend mengirim token JWT sebagai tanda sesi login berhasil.
- Saat login, backend memeriksa kredensial pengguna dan mengembalikan token yang sama.
- Token dipakai untuk menjaga sesi login dan memvalidasi request berikutnya.
- File terkait: [backend/authRoutes.js](backend/authRoutes.js), [backend/middleware.js](backend/middleware.js), [src/services/authService.ts](src/services/authService.ts), [src/store/useAuthStore.ts](src/store/useAuthStore.ts)

## 2. Alur Menampilkan Habit
- Setelah login, aplikasi mengambil data habit milik pengguna dari Firestore.
- Data habit ditampilkan di halaman utama dalam bentuk daftar.
- Pengguna bisa membuka detail habit untuk melihat informasi lebih lanjut.
- File terkait: [src/app/(tabs)/index.tsx](src/app/(tabs)/index.tsx), [src/app/habit/[id].tsx](src/app/habit/[id].tsx), [src/services/firebase.ts](src/services/firebase.ts)

## 3. Alur Membuat Habit Baru
- Pengguna membuka layar tambah habit.
- Pengguna memilih jenis habit:
  - Timed: habit yang harus diselesaikan dalam durasi tertentu.
  - Progress: habit yang dipecah menjadi beberapa checkpoint.
- Setelah data diisi, aplikasi menyimpan habit ke Firestore.
- Saat habit baru dibuat, sistem juga bisa memeriksa achievement yang mungkin terbuka.
- File terkait: [src/app/addhabit.tsx](src/app/addhabit.tsx), [src/services/gamificationService.ts](src/services/gamificationService.ts)

## 4. Alur Habit Timed
- Habit timed menampilkan timer.
- Saat tombol mulai ditekan, timer berjalan.
- Jika timer selesai sebelum pengguna keluar aplikasi, habit dianggap berhasil.
- Sistem memberi poin, menambah streak, dan mencatat history.
- Jika pengguna keluar aplikasi terlalu lama, habit dianggap gagal.
- File terkait: [src/components/timed-habit-detail.tsx](src/components/timed-habit-detail.tsx), [src/services/gamificationService.ts](src/services/gamificationService.ts), [src/services/streakService.ts](src/services/streakService.ts), [src/services/historyService.ts](src/services/historyService.ts)

## 5. Alur Habit Progress
- Habit progress memiliki beberapa checkpoint.
- Saat habit dimulai, checkpoint pertama dijadwalkan.
- Pengguna bisa menandai checkpoint sebagai berhasil atau gagal.
- Jika berhasil, checkpoint berikutnya akan terbuka.
- Jika gagal atau lewat deadline, checkpoint tersebut dianggap gagal.
- Setelah seluruh checkpoint selesai, habit bisa dianggap berhasil atau gagal tergantung hasil siklus.
- Sistem memberi poin dan menyimpan history sesuai hasilnya.
- File terkait: [src/components/progress-habit-detail.tsx](src/components/progress-habit-detail.tsx), [backend/progressReconciler.js](backend/progressReconciler.js), [src/services/notificationService.ts](src/services/notificationService.ts)

## 6. Alur Notifikasi dan Reminder
- Sistem mengatur reminder untuk habit progress dan timed habit.
- Reminder membantu pengguna mengingat bahwa checkpoint atau timer perlu diproses.
- Jika deadline terlewati, aplikasi akan memproses habit tersebut secara otomatis.
- Proses ini disebut rekonsiliasi missed progress habit.
- File terkait: [src/services/notificationService.ts](src/services/notificationService.ts), [backend/server.js](backend/server.js), [backend/progressReconciler.js](backend/progressReconciler.js)

## 7. Alur Poin, Streak, dan Achievement
- Saat habit selesai, sistem menambah poin pengguna.
- Poin digunakan untuk menghitung level pengguna.
- Saat habit selesai secara berurutan, streak akan bertambah.
- Streak tertentu bisa memberi bonus poin.
- Jika pengguna mencapai target tertentu, achievement akan terbuka.
- File terkait: [src/services/gamificationService.ts](src/services/gamificationService.ts), [src/services/streakService.ts](src/services/streakService.ts), [src/services/achievementService.ts](src/services/achievementService.ts)

## 8. Alur History
- Setiap habit selesai atau gagal akan dicatat ke koleksi history.
- History berguna sebagai riwayat aktivitas pengguna.
- Data ini bisa dipakai untuk melihat performa pengguna di masa lalu.
- File terkait: [src/services/historyService.ts](src/services/historyService.ts)

## 9. Alur Backend
- Backend berjalan dengan Express.
- Backend menyediakan endpoint untuk autentikasi dan rekonsiliasi habit progress.
- Backend terhubung ke Firestore melalui Firebase Admin SDK.
- Scheduler backend berjalan secara berkala untuk memeriksa habit progres yang terlewat.
- File terkait: [backend/server.js](backend/server.js), [backend/firebaseConfig.js](backend/firebaseConfig.js), [backend/progressReconciler.js](backend/progressReconciler.js)
