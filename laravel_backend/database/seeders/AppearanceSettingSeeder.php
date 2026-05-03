<?php

namespace Database\Seeders;

use App\Models\AppearanceSetting;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class AppearanceSettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            // Theme Mode
            [
                'key' => 'mode',
                'value' => 'light',
                'label' => 'Theme Mode',
                'description' => 'Light or dark mode',
                'category' => 'mode',
                'sort_order' => 1,
            ],

            // Primary/Active Color (Sidebar active, main accent)
            [
                'key' => 'primary_color',
                'value' => '#22c55e',
                'label' => 'Primary / Active Color',
                'description' => 'Color for active sidebar item, hover states, and primary highlights',
                'category' => 'colors',
                'sort_order' => 2,
            ],

            // Button Colors
            [
                'key' => 'button_primary',
                'value' => '#7f0518',
                'label' => 'Primary Button',
                'description' => 'Add, Save, Submit buttons',
                'category' => 'buttons',
                'sort_order' => 3,
            ],
            [
                'key' => 'button_secondary',
                'value' => '#eab308',
                'label' => 'Secondary Button',
                'description' => 'Alternative action buttons',
                'category' => 'buttons',
                'sort_order' => 4,
            ],

            // Border Color
            [
                'key' => 'border_color',
                'value' => '#da2b2b',
                'label' => 'Border Color',
                'description' => 'Cards, tables, inputs, and divider lines',
                'category' => 'borders',
                'sort_order' => 5,
            ],

            // Hover Color
            [
                'key' => 'hover_color',
                'value' => '#b22e5c',
                'label' => 'Hover Color',
                'description' => 'Table rows, buttons, and interactive elements hover background',
                'category' => 'interactions',
                'sort_order' => 6,
            ],

            // Pagination Colors
            [
                'key' => 'pagination_bg',
                'value' => '#7f0518',
                'label' => 'Pagination Background',
                'description' => 'Active page button background',
                'category' => 'pagination',
                'sort_order' => 7,
            ],
            [
                'key' => 'pagination_text',
                'value' => '#ffffff',
                'label' => 'Pagination Text',
                'description' => 'Active page button text color',
                'category' => 'pagination',
                'sort_order' => 8,
            ],

            // Background Colors
            [
                'key' => 'bg_primary',
                'value' => '#ffffff',
                'label' => 'Primary Background',
                'description' => 'Main content area background',
                'category' => 'backgrounds',
                'sort_order' => 9,
            ],
            [
                'key' => 'bg_secondary',
                'value' => '#f0fdf4',
                'label' => 'Secondary Background',
                'description' => 'Cards, modals, highlight areas',
                'category' => 'backgrounds',
                'sort_order' => 10,
            ],
            [
                'key' => 'bg_sidebar',
                'value' => '#ffffff',
                'label' => 'Sidebar Background',
                'description' => 'Sidebar navigation background',
                'category' => 'backgrounds',
                'sort_order' => 10,
            ],
            [
                'key' => 'bg_body',
                'value' => '#f3f4f6',
                'label' => 'Body Background',
                'description' => 'Page body/outer background',
                'category' => 'backgrounds',
                'sort_order' => 11,
            ],
            [
                'key' => 'bg_content',
                'value' => '#ffffff',
                'label' => 'Content Background',
                'description' => 'Main content card background',
                'category' => 'backgrounds',
                'sort_order' => 12,
            ],
            [
                'key' => 'bg_footer',
                'value' => '#111827',
                'label' => 'Footer Background',
                'description' => 'Footer section background',
                'category' => 'backgrounds',
                'sort_order' => 13,
            ],

            // Text Colors
            [
                'key' => 'text_primary',
                'value' => '#1f2937',
                'label' => 'Primary Text',
                'description' => 'Main text color',
                'category' => 'text',
                'sort_order' => 14,
            ],
            [
                'key' => 'text_secondary',
                'value' => '#6b7280',
                'label' => 'Secondary Text',
                'description' => 'Subtitles, labels, muted text',
                'category' => 'text',
                'sort_order' => 15,
            ],
            [
                'key' => 'text_sidebar',
                'value' => '#374151',
                'label' => 'Sidebar Text',
                'description' => 'Sidebar menu text color',
                'category' => 'text',
                'sort_order' => 16,
            ],
            [
                'key' => 'text_content',
                'value' => '#1f2937',
                'label' => 'Content Text',
                'description' => 'Main content area text color',
                'category' => 'text',
                'sort_order' => 17,
            ],
            
            // Font Sizes
            [
                'key' => 'font_size_base',
                'value' => '12',
                'label' => 'Base Font Size',
                'description' => 'Base font size for content (in pixels)',
                'category' => 'typography',
                'sort_order' => 18,
            ],
            [
                'key' => 'font_size_sidebar',
                'value' => '12',
                'label' => 'Sidebar Font Size',
                'description' => 'Font size for sidebar menu (in pixels)',
                'category' => 'typography',
                'sort_order' => 19,
            ],
        ];

        foreach ($settings as $setting) {
            AppearanceSetting::updateOrCreate(
                ['key' => $setting['key']],
                $setting
            );
        }
    }
}
