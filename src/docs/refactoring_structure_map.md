# Refactoring Structure Map: Legacy to Feature-Based Architecture

This document maps the consolidation of the legacy MVC structure into the new modular **Feature-Based Architecture**.

## 1. Core Structure Changes

| **Legacy Path** | **New Refactored Path** | **Description** |
| :--- | :--- | :--- |
| `src/controllers/` | `src/features/<feature>/controllers/` | Controllers moved to respective features |
| `src/services/` | `src/features/<feature>/services/` | Services moved to respective features |
| `src/routes/` | `src/features/<feature>/routes/` | Routes moved to respective features |
| `src/repositories/` | `src/features/<feature>/repositories/` | Repositories moved to respective features |
| `src/entities/` | `src/features/<feature>/entities/` | Entities moved to respective features |
| `src/job/` | `src/features/<feature>/jobs/` | Jobs distributed to relevant features |

---

## 2. Detailed Feature Mapping

### 🔐 Auth Feature (`src/features/auth`)
| Old File | New Location |
| :--- | :--- |
| `src/controllers/authController.js` | `src/features/auth/controllers/authController.js` |
| `src/services/authService.js` | `src/features/auth/services/authService.js` |
| `src/routes/authRoutes.js` | `src/features/auth/routes/authRoutes.js` |
| `src/features/admin/routes/adminVerificationRoutes.js` | `src/features/auth/routes/adminVerificationRoutes.js` |
| `src/features/admin/controllers/adminVerificationController.js` | `src/features/auth/controllers/adminVerificationController.js` |

### 👤 Patient Feature (`src/features/patient`)
| Old File | New Location |
| :--- | :--- |
| `src/controllers/patientController.js` | `src/features/patient/controllers/patientController.js` |
| `src/services/userService.js` (Patient logic) | `src/features/patient/services/patientService.js` |
| `src/routes/patientRoutes.js` | `src/features/patient/routes/patientRoutes.js` |

### 👨‍⚕️ Doctor Feature (`src/features/doctor`)
| Old File | New Location |
| :--- | :--- |
| `src/controllers/doctorController.js` | `src/features/doctor/controllers/doctorController.js` |
| `src/services/userService.js` (Doctor logic) | `src/features/doctor/services/doctorService.js` |
| `src/routes/doctorRoutes.js` | `src/features/doctor/routes/doctorRoutes.js` |
| `src/repositories/doctorProfileRepository.js` | `src/features/doctor/repositories/doctorProfileRepository.js` |

### 📅 Appointments Feature (`src/features/appointments`)
| Old File | New Location |
| :--- | :--- |
| `src/controllers/appointmentController.js` | `src/features/appointments/controllers/appointmentController.js` |
| `src/services/appointmentService.js` | `src/features/appointments/services/appointmentService.js` |
| `src/routes/appointmentRoutes.js` | `src/features/appointments/routes/index.js` |
| `src/repositories/appointmentRepository.js` | `src/features/appointments/repositories/appointmentRepository.js` |
| `src/entities/Appointment.js` | `src/features/appointments/entities/Appointment.js` |

### 💳 Payments & Transactions (`src/features/payments`)
*Consolidated from `transactions` and legacy services*
| Old File | New Location |
| :--- | :--- |
| `src/features/transactions/services/paymentService.js` | `src/features/payments/services/paymentService.js` |
| `src/features/transactions/services/walletService.js` | `src/features/payments/services/walletService.js` |
| `src/features/transactions/controllers/paymentController.js` | `src/features/payments/controllers/paymentController.js` |
| `src/features/transactions/routes/payment.js` | `src/features/payments/routes/payment.js` |
| `src/entities/Transaction.js` | `src/features/payments/entities/Transaction.js` |

### 📣 Marketing & Gamification (`src/features/marketing`)
*Consolidated from `gamification`*
| Old File | New Location |
| :--- | :--- |
| `src/features/gamification/services/spinningWheelService.js` | `src/features/marketing/services/spinningWheelService.js` |
| `src/features/gamification/controllers/spinningWheelController.js` | `src/features/marketing/controllers/spinningWheelController.js` |
| `src/features/gamification/routes/spinningWheelRoutes.js` | `src/features/marketing/routes/spinningWheelRoutes.js` |
| `src/entities/SpinReward.js` | `src/features/marketing/entities/SpinReward.js` |

### 💬 Chat Feature (`src/features/chat`)
| Old File | New Location |
| :--- | :--- |
| `src/services/chatService.js` | `src/features/chat/services/chatService.js` |
| `src/controllers/chatController.js` | `src/features/chat/controllers/chatController.js` |
| `src/entities/ChatRoom.js` | `src/features/chat/entities/ChatRoom.js` |

### 🔔 Notifications (`src/features/notifications`)
| Old File | New Location |
| :--- | :--- |
| `src/services/notificationService.js` | `src/features/notifications/services/notificationService.js` |
| `src/entities/Notification.js` | `src/features/notifications/entities/Notification.js` |

---

## 3. Shared Resources (`src/shared`)
Code that is used across multiple features was moved to `src/shared`.

| Old File | New Location |
| :--- | :--- |
| `src/services/email/` | `src/shared/services/email/` |
| `src/utils/` | `src/shared/utils/` |
| `src/middlewares/` | `src/shared/middlewares/` |
| `src/config/` | `src/config/` (Remained at root but referenced via shared patterns) |

---

## 4. Swagger Documentation Strategy
Swagger definitions have been decentralized. Instead of a monolithic file, each feature should ideally contain its own `docs/` or define Swagger specs via JSDoc in its routes.

- **Old:** Centralized `src/docs/` or scattered JSDoc.
- **New:** `src/features/<feature>/docs/swagger.yaml` (Recommended) or JSDoc within `src/features/<feature>/routes/`.

## 5. Summary of Benefits
1.  **Modularity**: Each feature is self-contained.
2.  **Scalability**: Easier to add new features without touching core files.
3.  **Maintainability**: Related files (Controllers, Services, Routes) are co-located.
4.  **Consolidation**: "Zombie" features like `gamification`, `admin`, and `transactions` were merged into their logical parents (`marketing`, `auth`, `payments`).
