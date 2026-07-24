const fs = require('fs');
const path = require('path');

const resDir = 'android/app/src/main/res';
const xmlDir = path.join(resDir, 'xml');
const layoutDir = path.join(resDir, 'layout');
const javaDir = 'android/app/src/main/java/com/schuyler/vianmaps';

fs.mkdirSync(xmlDir, { recursive: true });
fs.mkdirSync(layoutDir, { recursive: true });
fs.mkdirSync(javaDir, { recursive: true });

fs.writeFileSync(path.join(xmlDir, 'widget_info.xml'), `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="250dp"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/widget_layout"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:targetCellWidth="4"
    android:targetCellHeight="4" />
`);

fs.writeFileSync(path.join(layoutDir, 'widget_layout.xml'), `<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#FF111111">
    <ImageView
        android:id="@+id/widget_map_image"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:scaleType="centerCrop"
        android:background="#FF222222" />
    <ImageView
        android:id="@+id/widget_compass"
        android:layout_width="32dp"
        android:layout_height="32dp"
        android:layout_centerInParent="true"
        android:src="@android:drawable/ic_menu_compass" />
    <Button
        android:id="@+id/btn_up"
        android:layout_width="48dp"
        android:layout_height="48dp"
        android:layout_alignParentTop="true"
        android:layout_centerHorizontal="true"
        android:text="^"
        android:background="#88000000"
        android:textColor="#FFFFFF" />
    <Button
        android:id="@+id/btn_down"
        android:layout_width="48dp"
        android:layout_height="48dp"
        android:layout_alignParentBottom="true"
        android:layout_centerHorizontal="true"
        android:text="v"
        android:background="#88000000"
        android:textColor="#FFFFFF" />
    <Button
        android:id="@+id/btn_left"
        android:layout_width="48dp"
        android:layout_height="48dp"
        android:layout_alignParentLeft="true"
        android:layout_centerVertical="true"
        android:text="&lt;"
        android:background="#88000000"
        android:textColor="#FFFFFF" />
    <Button
        android:id="@+id/btn_right"
        android:layout_width="48dp"
        android:layout_height="48dp"
        android:layout_alignParentRight="true"
        android:layout_centerVertical="true"
        android:text="&gt;"
        android:background="#88000000"
        android:textColor="#FFFFFF" />
    <Button
        android:id="@+id/btn_gps"
        android:layout_width="48dp"
        android:layout_height="48dp"
        android:layout_alignParentBottom="true"
        android:layout_alignParentRight="true"
        android:layout_margin="8dp"
        android:text="GPS"
        android:textSize="12sp"
        android:background="#FF3B82F6"
        android:textColor="#FFFFFF" />
</RelativeLayout>
`);

fs.writeFileSync(path.join(javaDir, 'MapWidgetProvider.java'), `package com.schuyler.vianmaps;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class MapWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_layout);
            Intent intent = new Intent(context, MainActivity.class);
            intent.putExtra("fromWidget", true);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            
            views.setOnClickPendingIntent(R.id.widget_map_image, pendingIntent);
            views.setOnClickPendingIntent(R.id.btn_gps, pendingIntent);
            views.setOnClickPendingIntent(R.id.btn_up, pendingIntent);
            views.setOnClickPendingIntent(R.id.btn_down, pendingIntent);
            views.setOnClickPendingIntent(R.id.btn_left, pendingIntent);
            views.setOnClickPendingIntent(R.id.btn_right, pendingIntent);
            views.setOnClickPendingIntent(R.id.widget_compass, pendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }
}
`);

let manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
if (!manifest.includes('MapWidgetProvider')) {
    manifest = manifest.replace('</application>', `
        <receiver android:name=".MapWidgetProvider" android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/widget_info" />
        </receiver>
    </application>`);
    fs.writeFileSync('android/app/src/main/AndroidManifest.xml', manifest);
}
console.log("Widget files created");
