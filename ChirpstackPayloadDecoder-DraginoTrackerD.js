//Kamil AvH
//Chirpstack v4
//payload for Dragino TrackerD (firmware min. 1.4.7)


// Helper: Function to convert byte array to hexadecimal UUID
// Aide : Fonction pour convertir tableau de bytes en UUID hexadécimal
function bytesToHex(bytes) {
    return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// Main function called by Chirpstack
// Fonction principale appelée par Chirpstack
function decodeUplink(input) {
    return { 
        data: decode(input.fPort, input.bytes, input.variables)
    };   
}

// Main decoder based on fPort
// Décodeur principal selon fPort
function decode(fPort, bytes, variables) {
    let data = {};

    switch(fPort) {
        case 2:
        case 3:
            data = decodeLocationAndStatus(bytes, fPort);
            break;

        case 4:
            data = decodeLocationWithTimestamp(bytes);
            break;

        case 5:
            data = decodeDeviceInformation(bytes);
            break;

        case 6:
            data = decodeBeaconData(bytes);
            break;

        case 7:
            data = decodeSimpleStatus(bytes);
            break;

        case 8:
            data = decodeWifiScan(bytes);
            break;

        case 10:
            data = decodeMacScan(bytes);
            break;

        default:
            data = { error: "Unknown fPort" }; // Unknown fPort
            // fPort inconnu
    }

    return data;
}

// ------------------------------
// Decoding by message type
// Décodages par type de message
// ------------------------------

// Decode for GPS + Battery + Alarm (fPort 2 and 3)
// Décodage pour GPS + Battery + Alarme (fPort 2 et 3)
function decodeLocationAndStatus(bytes, fPort) {
    let lat = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) / 1e6;
    let lon = ((bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7]) / 1e6;
    let batV = (((bytes[8] & 0x3F) << 8) | bytes[9]) / 1000;
    let batP = calculateBatteryLevel(batV);  // Battery level calculation in %
    // Calcul du niveau de la batterie en %
    let alarm = (bytes[8] & 0x40) ? true : false;
    let mode = bytes[10] & 0xC0;
    let ledStatus = (bytes[10] & 0x20) ? "ON" : "OFF";
    let movement = (bytes[10] & 0x10) ? "MOVE" : "STILL";
    let bg = (bytes[10] >> 3) & 0x01;

    let data = {
        Latitude: lat,
        Longitude: lon,
        BatV: batV,
        BatP: batP, 
        Alarm: alarm,
        Mode: mode,
        LED_Status: ledStatus,
        Movement: movement,
        Background_Mode: bg,
    };

    if (bg === 1 && bytes.length >= 18) {
        // Process date/time
        // Traite date/heure
        data.Date = formatDateTime(bytes.slice(11, 18));
    } else if (fPort === 2 && bytes.length >= 15) {
        // Temperature and humidity measurements
        // Mesures de température et humidité
        data.Hum = ((bytes[11] << 8) | bytes[12]) / 10;
        data.Tem = ((bytes[13] << 24) >> 16 | bytes[14]) / 10;
    }

    return data;
}

// Decode GPS + Timestamp (fPort 4)
// Décodage GPS + Timestamp (fPort 4)
function decodeLocationWithTimestamp(bytes) {
    let lat = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) / 1e6;
    let lon = ((bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7]) / 1e6;
    let datetime = formatDateTime(bytes.slice(8, 15));

    return {
        Latitude: lat,
        Longitude: lon,
        Date: datetime.date,
        Time: datetime.time,
    };
}

// Decode Device Info (fPort 5)
// Décodage Device Info (fPort 5)
function decodeDeviceInformation(bytes) {
    const bands = ["EU868", "US915", "IN865", "AU915", "KZ865", "RU864", "AS923", "AS923_1", "AS923_2", "AS923_3", "CN470", "EU433", "KR920", "MA869"];
    let sensorMode = (bytes[0] === 0x13) ? "TrackerD" : "NULL";
    let freqBand = bands[bytes[3] - 1] || "Unknown";
    let firmwareVersion = `${bytes[1] & 0x0F}.${(bytes[2] >> 4) & 0x0F}.${bytes[2] & 0x0F}`;
    let batV = ((bytes[5] << 8) | bytes[6]) / 1000;
    let batP = calculateBatteryLevel(batV);  // Battery level calculation in %
    // Calcul du niveau de la batterie en %

    return {
        Sensor_Mode: sensorMode,
        Firmware_Version: firmwareVersion,
        Frequency_Band: freqBand,
        Sub_Band: bytes[4] === 0xFF ? "NULL" : bytes[4],
        BatV: batV,
        BatP: batP, 
    };
}

// Decode Beacon (fPort 6)
// Décodage Beacon (fPort 6)
function decodeBeaconData(bytes) {
    let uuid = bytesToHex(bytes.slice(0, 16));
    let major = (bytes[16] << 8) | bytes[17];
    let minor = (bytes[18] << 8) | bytes[19];
    let power = bytes[15];
    let rssi1m = bytes[21] << 24 >> 24;
    let rssi = bytes[23] << 24 >> 24;
    let batV = (((bytes[24] & 0x3F) << 8) | bytes[25]) / 1000;
    let batP = calculateBatteryLevel(batV);  // Battery level calculation in %
    // Calcul du niveau de la batterie en %
    let alarm = (bytes[24] & 0x40) ? true : false;
    let mode = (bytes[26] & 0xC0) >> 6;

    return {
        UUID: uuid,
        MAJOR: major,
        MINOR: minor,
        POWER: power,
        RSSI: rssi,
        RSSI_at_1m: rssi1m,
        BatV: batV,
        BatP: batP,
        Alarm: alarm,
        Mode: mode,
    };
}

// Decode simple (Battery + Alarm) (fPort 7)
// Décodage simple (Battery + Alarme) (fPort 7)
function decodeSimpleStatus(bytes) {
    let batV = (((bytes[0] & 0x3F) << 8) | bytes[1]) / 1000;
    let batP = calculateBatteryLevel(batV);  // Battery level calculation in %
    // Calcul du niveau de la batterie en %
    let alarm = (bytes[0] & 0x40) ? true : false;
    let mode = (bytes[2] & 0xC0) >> 6;
    let ledStatus = (bytes[2] & 0x20) ? "ON" : "OFF";

    return {
        BatV: batV,
        BatP: batP,
        Alarm: alarm,
        Mode: mode,
        LED_Status: ledStatus,
    };
}

// Decode WIFI SSID + RSSI (fPort 8)
// Décodage WIFI SSID + RSSI (fPort 8)
function decodeWifiScan(bytes) {
    let ssid = String.fromCharCode(...bytes.slice(0, 6));
    let rssi = bytes[6] << 24 >> 24;
    let batV = (((bytes[7] & 0x3F) << 8) | bytes[8]) / 1000;
    let batP = calculateBatteryLevel(batV);  // Battery level calculation in %
    // Calcul du niveau de la batterie en %
    let alarm = (bytes[7] & 0x40) ? true : false;
    let mode = (bytes[9] & 0xC0) >> 6;
    let ledStatus = (bytes[9] & 0x20) ? "ON" : "OFF";

    return {
        WIFI_SSID: ssid,
        RSSI: rssi,
        BatV: batV,
        BatP: batP,
        Alarm: alarm,
        Mode: mode,
        LED_Status: ledStatus,
    };
}

// Decode MAC Scan (fPort 10)
// Décodage Scan MAC (fPort 10)
function decodeMacScan(bytes) {
    return {
        MAC1: bytesToHex(bytes.slice(0, 6)),
        RSSI1: bytes[6] << 24 >> 24,
        MAC2: bytesToHex(bytes.slice(7, 13)),
        RSSI2: bytes[13] << 24 >> 24,
        MAC3: bytesToHex(bytes.slice(14, 20)),
        RSSI3: bytes[20] << 24 >> 24,
        BatV: (((bytes[21] & 0x3F) << 8) | bytes[22]) / 1000,
        BatP: calculateBatteryLevel((((bytes[21] & 0x3F) << 8) | bytes[22]) / 1000),  // Battery level calculation in %
        // Calcul du niveau de la batterie en %
        Alarm: (bytes[21] & 0x40) ? true : false,
        Mode: (bytes[23] & 0xC0) >> 6,
    };
}

// ------------------------------
// Helpers
// ------------------------------

// Converts byte array to Date and Time
// Convertit tableau de bytes en Date et Heure
function formatDateTime(dateBytes) {
    let year = (dateBytes[0] << 8) | dateBytes[1];
    let month = dateBytes[2];
    let day = dateBytes[3];
    let hour = dateBytes[4];
    let minute = dateBytes[5];
    let second = dateBytes[6];

    return {
        date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
    };
}

// Function to calculate battery level as percentage
// Fonction pour calculer le niveau de batterie en pourcentage
function calculateBatteryLevel(batV) {
    var level = (batV - 2.8) / (4.002 - 2.8) * 100;  // Convert voltage to percentage
    // Conversion de la tension en pourcentage
    if (level > 100) level = 100;  // If the level exceeds 100%, limit it to 100%
    // Si le niveau dépasse 100%, on le limite à 100%
    if (level < 0) level = 0;      // If the level is below 0%, limit it to 0%
    // Si le niveau est inférieur à 0%, on le limite à 0%
    return Math.round(level);  // Return the rounded battery level
}
