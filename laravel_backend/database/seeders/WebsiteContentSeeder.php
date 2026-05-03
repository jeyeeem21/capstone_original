<?php

namespace Database\Seeders;

use App\Models\BusinessSetting;
use App\Models\WebsiteContent;
use Illuminate\Database\Seeder;

class WebsiteContentSeeder extends Seeder
{
    /**
     * Seed default website content for Home and About pages.
     */
    public function run(): void
    {
        $startYear = BusinessSetting::where('key', 'business_start_year')->value('value') ?? '2010';
        $yearsInBusiness = now()->year - (int) $startYear;

        // Home page content
        $homeDefaults = [
            'heroTitle' => 'Quality Rice',
            'heroTitleHighlight' => 'From Farm to Table',
            'heroSubtitle' => 'Experience the finest selection of premium rice products. From aromatic jasmine to nutritious brown rice, we deliver excellence in every grain.',
            'heroTag' => "Premium Quality Rice Since {$startYear}",
            'aboutTitle' => "Committed to Quality Since {$startYear}",
            'aboutDescription' => "KJP Ricemill has been a trusted name in the rice industry for over {$yearsInBusiness} years. We take pride in sourcing the finest quality rice from local farmers and delivering it fresh to your doorstep.",
            'aboutPoints' => [
                'Premium quality rice from trusted farmers',
                'Modern milling facilities for best results',
                'Strict quality control standards',
                'Reliable delivery across the region',
            ],
            'stats' => [
                ['value' => "{$yearsInBusiness}+", 'label' => 'Years Experience'],
                ['value' => '500+', 'label' => 'Happy Customers'],
                ['value' => '50K+', 'label' => 'Bags Delivered'],
                ['value' => '99%', 'label' => 'Satisfaction Rate'],
            ],
            'features' => [
                ['title' => 'Quality Assured', 'description' => 'Every grain passes through rigorous quality checks to ensure premium standards.'],
                ['title' => 'Farm Fresh', 'description' => 'Sourced directly from local farmers, ensuring freshness from harvest to your table.'],
                ['title' => 'Fast Delivery', 'description' => 'Reliable delivery service to get your orders to you quickly and efficiently.'],
                ['title' => 'Best Prices', 'description' => 'Competitive wholesale and retail prices without compromising on quality.'],
            ],
        ];

        // About page content
        $aboutDefaults = [
            'heroTitle' => 'Our Story of',
            'heroTitleHighlight' => 'Excellence & Quality',
            'heroSubtitle' => "For over {$yearsInBusiness} years, KJP Ricemill has been committed to delivering the finest quality rice products to Filipino households and businesses.",
            'missionTitle' => 'Our Mission',
            'missionDescription' => 'To provide Filipino families and businesses with the highest quality rice products at fair prices, while supporting local farmers and sustainable agricultural practices.',
            'missionPoints' => [
                'Deliver premium quality rice consistently',
                'Support local farming communities',
                'Ensure fair and competitive pricing',
                'Provide exceptional customer service',
            ],
            'visionTitle' => 'Our Vision',
            'visionDescription' => 'To become the most trusted and preferred rice supplier in the Philippines, known for our unwavering commitment to quality, innovation, and customer satisfaction.',
            'visionPoints' => [
                'Be the leading rice supplier in the region',
                'Pioneer innovative milling technologies',
                'Create lasting value for all stakeholders',
                'Promote sustainable rice production',
            ],
            'values' => [
                ['title' => 'Quality First', 'description' => 'We never compromise on the quality of our rice products, ensuring every grain meets our high standards.'],
                ['title' => 'Customer Care', 'description' => 'Building lasting relationships with our customers through exceptional service and reliability.'],
                ['title' => 'Sustainability', 'description' => 'Supporting local farmers and implementing eco-friendly practices in our operations.'],
                ['title' => 'Excellence', 'description' => 'Striving for excellence in everything we do, from sourcing to delivery.'],
            ],
            'timeline' => [
                ['year' => $startYear, 'title' => 'Foundation', 'description' => 'KJP Ricemill was established with a small milling facility and a vision for quality.'],
                ['year' => (string) ((int) $startYear + 4), 'title' => 'Expansion', 'description' => 'Expanded operations with modern milling equipment and increased storage capacity.'],
                ['year' => (string) ((int) $startYear + 8), 'title' => 'Growth', 'description' => 'Reached 100+ regular customers and established partnerships with local farmers.'],
                ['year' => (string) ((int) $startYear + 12), 'title' => 'Innovation', 'description' => 'Implemented digital inventory system and launched online ordering platform.'],
                ['year' => (string) now()->year, 'title' => 'Present', 'description' => 'Serving 500+ customers with a diverse range of premium rice products.'],
            ],
            'team' => [
                ['name' => 'Jose P. Katipunan', 'role' => 'Founder & CEO'],
                ['name' => 'Maria Santos', 'role' => 'Operations Manager'],
                ['name' => 'Pedro Garcia', 'role' => 'Quality Control Head'],
                ['name' => 'Ana Reyes', 'role' => 'Sales Manager'],
            ],
        ];

        WebsiteContent::saveHomeContent($homeDefaults);
        WebsiteContent::saveAboutContent($aboutDefaults);
    }
}
