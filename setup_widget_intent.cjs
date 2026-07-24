const fs = require('fs');
const javaDir = 'android/app/src/main/java/com/schuyler/vianmaps';
const path = require('path');

fs.writeFileSync(path.join(javaDir, 'MapWidgetProvider.java'), `package com.schuyler.vianmaps;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class MapWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_layout);
            
            // Open the app via deep link so Capacitor catches it
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://vianmaps.app/?widget=true"));
            intent.setPackage(context.getPackageName());
            
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
console.log("Updated intent in widget");
