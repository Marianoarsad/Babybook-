export const initialProfiles = [
    {
        id: "1",
        name: "Maya",
        dateOfBirth: "2025-12-16",
        timeOfBirth: "08:45",
        gender: "girl",
        birthWeight: 3.2,
        birthHeight: 49.0,
        hospital: "St. Jude Medical Center",
        obgynName: "Dr. James Miller",
        pediatricianName: "Dr. Sarah Chen",
        avatarUrl:
            "https://images.unsplash.com/photo-1519689680058-324335c77eb2?q=80&w=300&auto=format&fit=crop",
        allergies: ["Penicillin"],
        hereditaryConditions: ["Asthma (maternal)"],
        currentHeight: 68.2,
        currentWeight: 7.4,
    },
    {
        id: "2",
        name: "Leo",
        dateOfBirth: "2026-02-14",
        timeOfBirth: "14:20",
        gender: "boy",
        birthWeight: 3.5,
        birthHeight: 51.0,
        hospital: "St. Mary's Pediatric Wing",
        obgynName: "Dr. Sarah Mitchell",
        pediatricianName: "Dr. Arthur Robles",
        avatarUrl:
            "https://images.unsplash.com/photo-1596870230751-ebdfce98ec42?q=80&w=300&auto=format&fit=crop",
        allergies: ["Lactose"],
        hereditaryConditions: ["Eczema"],
        currentHeight: 64.5,
        currentWeight: 6.8,
    },
];

export const initialImmunizations = [
    {
        id: "v1",
        vaccineName: "HepB (Hepatitis B)",
        visitName: "Birth Dose",
        dueDate: "2025-12-16",
        completedDate: "2025-12-16",
        isCompleted: true,
        notes: "Given at St. Jude Hospital",
    },
    {
        id: "v2",
        vaccineName: "Rotavirus (RV1), DTaP, Hib, IPV, PCV13",
        visitName: "2 Month Wellness",
        dueDate: "2026-02-16",
        completedDate: "2026-02-17",
        isCompleted: true,
        notes: "Mild fever managed with paracetamol",
    },
    {
        id: "v3",
        vaccineName: "DTaP, IPV, Hib, HepB, PCV13",
        visitName: "4 Month Wellness",
        dueDate: "2026-04-16",
        completedDate: "2026-04-16",
        isCompleted: true,
        notes: "Regular checkup visit complete",
    },
    {
        id: "v4",
        vaccineName: "DTaP, IPV, Hib, HepB, PCV13, RV",
        visitName: "6 Month Wellness",
        dueDate: "2026-06-16",
        isCompleted: false,
        notes: "Next scheduled visit",
    },
    {
        id: "v5",
        vaccineName: "Influenza (Flu)",
        visitName: "Annual Vaccination",
        dueDate: "2026-08-15",
        isCompleted: false,
    },
    {
        id: "v6",
        vaccineName: "MMR, Varicella, HepA",
        visitName: "12 Month Wellness",
        dueDate: "2026-12-16",
        isCompleted: false,
    },
];

export const initialFeedLogs = [
    {
        id: "f1",
        timestamp: "2026-06-16T19:30:00Z",
        feedType: "milk",
        amountMl: 150,
        notes: "Breastmilk from bottle",
    },
    {
        id: "f2",
        timestamp: "2026-06-16T15:00:00Z",
        feedType: "milk",
        amountMl: 120,
        notes: "Formula milk",
    },
    {
        id: "f3",
        timestamp: "2026-06-16T12:00:00Z",
        feedType: "solids",
        grams: 110,
        notes: "Pureed carrot & apple",
    },
    {
        id: "f4",
        timestamp: "2026-06-16T08:00:00Z",
        feedType: "milk",
        amountMl: 160,
        notes: "Woke up hungry",
    },
];

export const initialSleepLogs = [
    {
        id: "s1",
        startTimestamp: "2026-06-16T21:00:00Z",
        endTimestamp: "2026-06-17T06:30:00Z",
        totalMinutes: 570,
    },
    {
        id: "s2",
        startTimestamp: "2026-06-16T13:30:00Z",
        endTimestamp: "2026-06-16T15:00:00Z",
        totalMinutes: 90,
    },
    {
        id: "s3",
        startTimestamp: "2026-06-16T09:30:00Z",
        endTimestamp: "2026-06-16T10:15:00Z",
        totalMinutes: 45,
    },
];

export const initialMilestones = [
    {
        id: "m1",
        title: "Rolled Over",
        date: "2026-04-12",
        description:
            "Leo successfully rolled from back to tummy today! Very determined.",
        photoUrl:
            "https://images.unsplash.com/photo-1544161513-0179fe746fd5?q=80&w=400&auto=format&fit=crop",
        isCompleted: true,
    },
    {
        id: "m2",
        title: "First Tooth",
        date: "2026-05-05",
        description:
            "Spotted the first bottom incisor peeking out. A little fussy but doing great.",
        photoUrl:
            "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?q=80&w=400&auto=format&fit=crop",
        isCompleted: true,
    },
    {
        id: "m3",
        title: "First Smile",
        date: "2026-02-14",
        description:
            "Smiled right back at Sarah during tummy time. Cutest Valentine gift!",
        photoUrl:
            "https://images.unsplash.com/photo-1519689680058-324335c77eb2?q=80&w=400&auto=format&fit=crop",
        isCompleted: true,
    },
    {
        id: "m4",
        title: "Preschool Start",
        date: "2026-09-01",
        description:
            "Projected enrollment for early developmental playgroup & parent-child circle.",
        photoUrl: "",
        isCompleted: false,
    },
];

export const initialUpdates = [
    {
        id: "u1",
        category: "LATEST",
        date: "MAY 24, 2026",
        title: "Operation Timbang & Health Screening",
        content:
            "Join us this Saturday at the Barangay Multi-Purpose Hall. Mandatory height and weight checks for children 0-5 years old. Free Vitamin A supplementation and pediatric health consultations will be provided.",
    },
    {
        id: "u2",
        category: "ALERT",
        date: "MAY 23, 2026",
        title: '"Family First" Subsidy Registration',
        content:
            "Registration for the municipal first-year healthcare subsidy program opens tomorrow. Bring baby registration records and birth certificates to Barangay Hall Desk C.",
    },
    {
        id: "u3",
        category: "INFO",
        date: "MAY 15, 2026",
        title: "Community Newborn Massage Circle",
        content:
            "Free infant massage workshop held by licensed pediatric therapists. Wednesdays at 10:00 AM. Bring your own baby blanket.",
    },
];

export const initialClinics = [
    {
        id: "c1",
        name: "St. Raphael Children's Clinic",
        distance: "0.8km away",
        rating: 4.9,
        address: "Maginhawa St., Quezon City",
        imageUrl:
            "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=300&auto=format&fit=crop",
    },
    {
        id: "c2",
        name: "District III Family Health Center",
        distance: "1.2km away",
        rating: 4.7,
        address: "Aurora Blvd., Cubao",
        imageUrl:
            "https://images.unsplash.com/photo-1586773860418-d3b3de97e663?q=80&w=300&auto=format&fit=crop",
    },
    {
        id: "c3",
        name: "Kindred Pediatric Orthopedics",
        distance: "2.5km away",
        rating: 4.8,
        address: "Katipunan Ave, Quezon City",
        imageUrl:
            "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=300&auto=format&fit=crop",
    },
];

export const initialWorkshops = [
    {
        id: "w1",
        month: "JUN",
        day: "12",
        title: "Positive Parenting & Early Milestones",
        instructor: "Dr. Clara Reyes",
        time: "2:00 PM",
        platform: "Zoom",
    },
    {
        id: "w2",
        month: "JUN",
        day: "20",
        title: "Infant CPR & First Aid Certification",
        instructor: "Red Cross Nurse Elena",
        time: "10:00 AM",
        platform: "In-Person",
    },
    {
        id: "w3",
        month: "JUL",
        day: "05",
        title: "Complementary Feeding & Food Solid Rules",
        instructor: "Nutritionist Rose Santos",
        time: "4:00 PM",
        platform: "Google Meet",
    },
];

export const initialNotifications = [
    {
        id: "n1",
        title: "Vaccination Due",
        message:
            'Leo\'s "6 Month Wellness" vaccination (DTaP, IPV, Hib, HepB, PCV13, RV) is scheduled for next week.',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        isRead: false,
        category: "vaccine",
    },
    {
        id: "n2",
        title: "New Barangay Health Event",
        message:
            "Operation Timbang & Health Screening starting this Saturday at the Barangay Multi-Purpose Hall. Vitamin A supplements available.",
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        isRead: false,
        category: "barangay",
    },
    {
        id: "n3",
        title: "Milestone Memory Saved!",
        message:
            "You have updated pediatric parameters for Maya and recorded a new growth milestone.",
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        isRead: true,
        category: "milestone",
    },
    {
        id: "n4",
        title: "System Access Confirmed",
        message:
            "Your parent profile settings are active. Upgrade to premium anywhere to access exports.",
        timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
        isRead: true,
        category: "system",
    },
];

export const initialAppointments = [
    {
        id: "a1",
        profileId: "1",
        title: "6-Month Developmental Screening Check up",
        provider: "Dr. Sarah Chen",
        date: "2026-06-25",
        time: "10:30",
        notes: "Primary developmental assessment, height-weight monitoring, and general screening.",
        reminderActive: true,
        isCompleted: false,
    },
    {
        id: "a2",
        profileId: "1",
        title: "DTaP & Hib Immunity Booster Shot",
        provider: "Dr. Sarah Chen",
        date: "2026-06-16",
        time: "09:00",
        notes: "Booster shots administered successfully. Minor redness expected.",
        reminderActive: false,
        isCompleted: true,
        completedDate: "2026-06-16",
    },
    {
        id: "a3",
        profileId: "2",
        title: "Healthy Newborn Hip & Sight Exam",
        provider: "Dr. Arthur Robles",
        date: "2026-07-02",
        time: "14:00",
        notes: "First physical motor evaluation & vision tests recommendation.",
        reminderActive: true,
        isCompleted: false,
    },
];
