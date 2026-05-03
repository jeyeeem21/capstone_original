<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WebsiteContent extends Model
{
    protected $fillable = [
        'page',
        'section',
        'key',
        'value',
        'meta',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'meta' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Get all content for a specific page
     */
    public static function getPageContent(string $page): array
    {
        $contents = self::where('page', $page)
            ->where('is_active', true)
            ->orderBy('section')
            ->orderBy('sort_order')
            ->get();

        $result = [];
        foreach ($contents as $content) {
            if (!isset($result[$content->section])) {
                $result[$content->section] = [];
            }

            // If meta exists, merge it with the value
            if ($content->meta) {
                $result[$content->section][$content->key] = array_merge(
                    ['value' => $content->value],
                    $content->meta
                );
            } else {
                $result[$content->section][$content->key] = $content->value;
            }
        }

        return $result;
    }

    /**
     * Get structured content for Home page
     */
    public static function getHomeContent(): array
    {
        $raw = self::getPageContent('home');
        
        return [
            'heroTitle' => $raw['hero']['title'] ?? 'Quality Rice',
            'heroTitleHighlight' => $raw['hero']['titleHighlight'] ?? 'From Farm to Table',
            'heroSubtitle' => $raw['hero']['subtitle'] ?? 'Experience the finest selection of premium rice products.',
            'heroTag' => $raw['hero']['tag'] ?? ('Premium Quality Rice Since ' . (\App\Models\BusinessSetting::where('key', 'business_start_year')->value('value') ?? '2010')),
            'heroImage' => $raw['hero']['image'] ?? null,
            'aboutTitle' => $raw['aboutPreview']['title'] ?? ('Committed to Quality Since ' . (\App\Models\BusinessSetting::where('key', 'business_start_year')->value('value') ?? '2010')),
            'aboutDescription' => $raw['aboutPreview']['description'] ?? 'KJP Ricemill has been a trusted name in the rice industry.',
            'aboutPoints' => self::extractArrayItems($raw, 'aboutPreview', 'point'),
            'stats' => self::extractArrayItemsWithMeta($raw, 'stats'),
            'features' => self::extractArrayItemsWithMeta($raw, 'features'),
        ];
    }

    /**
     * Get structured content for About page
     */
    public static function getAboutContent(): array
    {
        $raw = self::getPageContent('about');
        
        return [
            'heroTitle' => $raw['hero']['title'] ?? 'Our Story of',
            'heroTitleHighlight' => $raw['hero']['titleHighlight'] ?? 'Excellence & Quality',
            'heroSubtitle' => $raw['hero']['subtitle'] ?? 'KJP Ricemill has been committed to delivering the finest quality rice products to Filipino households and businesses.',
            'heroImage' => $raw['hero']['image'] ?? null,
            'missionTitle' => $raw['mission']['title'] ?? 'Our Mission',
            'missionDescription' => $raw['mission']['description'] ?? 'To provide Filipino families and businesses with the highest quality rice products.',
            'missionPoints' => self::extractArrayItems($raw, 'mission', 'point'),
            'visionTitle' => $raw['vision']['title'] ?? 'Our Vision',
            'visionDescription' => $raw['vision']['description'] ?? 'To become the most trusted and preferred rice supplier in the Philippines.',
            'visionPoints' => self::extractArrayItems($raw, 'vision', 'point'),
            'values' => self::extractArrayItemsWithMeta($raw, 'values'),
            'timeline' => self::extractArrayItemsWithMeta($raw, 'timeline'),
            'team' => self::extractArrayItemsWithMeta($raw, 'team'),
        ];
    }

    /**
     * Extract simple array items (like points)
     */
    private static function extractArrayItems(array $raw, string $section, string $prefix): array
    {
        $items = [];
        if (isset($raw[$section])) {
            foreach ($raw[$section] as $key => $value) {
                if (str_starts_with($key, $prefix)) {
                    $items[] = is_array($value) ? ($value['value'] ?? '') : $value;
                }
            }
        }
        return $items;
    }

    /**
     * Extract array items with metadata (like features, testimonials)
     */
    private static function extractArrayItemsWithMeta(array $raw, string $section): array
    {
        $items = [];
        if (isset($raw[$section])) {
            foreach ($raw[$section] as $key => $item) {
                if (is_numeric($key) || str_starts_with($key, 'item')) {
                    if (is_array($item)) {
                        $items[] = $item;
                    }
                }
            }
        }
        // Sort by sort_order if exists
        usort($items, fn($a, $b) => ($a['sort_order'] ?? 0) - ($b['sort_order'] ?? 0));
        return $items;
    }

    /**
     * Save Home page content
     */
    public static function saveHomeContent(array $data): void
    {
        // Save hero section
        self::upsertContent('home', 'hero', 'title', $data['heroTitle'] ?? '');
        self::upsertContent('home', 'hero', 'titleHighlight', $data['heroTitleHighlight'] ?? '');
        self::upsertContent('home', 'hero', 'subtitle', $data['heroSubtitle'] ?? '');
        self::upsertContent('home', 'hero', 'tag', $data['heroTag'] ?? '');
        if (isset($data['heroImage'])) {
            self::upsertContent('home', 'hero', 'image', $data['heroImage']);
        }

        // Save about preview section
        self::upsertContent('home', 'aboutPreview', 'title', $data['aboutTitle'] ?? '');
        self::upsertContent('home', 'aboutPreview', 'description', $data['aboutDescription'] ?? '');

        // Save about points
        self::deleteSection('home', 'aboutPreview', 'point%');
        foreach (($data['aboutPoints'] ?? []) as $index => $point) {
            self::upsertContent('home', 'aboutPreview', "point{$index}", $point, null, $index);
        }

        // Save stats
        self::saveArraySection('home', 'stats', $data['stats'] ?? []);

        // Save features
        self::saveArraySection('home', 'features', $data['features'] ?? []);
    }

    /**
     * Save About page content
     */
    public static function saveAboutContent(array $data): void
    {
        // Save hero section
        self::upsertContent('about', 'hero', 'title', $data['heroTitle'] ?? '');
        self::upsertContent('about', 'hero', 'titleHighlight', $data['heroTitleHighlight'] ?? '');
        self::upsertContent('about', 'hero', 'subtitle', $data['heroSubtitle'] ?? '');
        if (isset($data['heroImage'])) {
            self::upsertContent('about', 'hero', 'image', $data['heroImage']);
        }

        // Save mission section
        self::upsertContent('about', 'mission', 'title', $data['missionTitle'] ?? '');
        self::upsertContent('about', 'mission', 'description', $data['missionDescription'] ?? '');
        self::deleteSection('about', 'mission', 'point%');
        foreach (($data['missionPoints'] ?? []) as $index => $point) {
            self::upsertContent('about', 'mission', "point{$index}", $point, null, $index);
        }

        // Save vision section
        self::upsertContent('about', 'vision', 'title', $data['visionTitle'] ?? '');
        self::upsertContent('about', 'vision', 'description', $data['visionDescription'] ?? '');
        self::deleteSection('about', 'vision', 'point%');
        foreach (($data['visionPoints'] ?? []) as $index => $point) {
            self::upsertContent('about', 'vision', "point{$index}", $point, null, $index);
        }

        // Save values
        self::saveArraySection('about', 'values', $data['values'] ?? []);

        // Save timeline
        self::saveArraySection('about', 'timeline', $data['timeline'] ?? []);

        // Save team
        self::saveArraySection('about', 'team', $data['team'] ?? []);
    }

    /**
     * Upsert a single content item
     */
    private static function upsertContent(string $page, string $section, string $key, ?string $value, ?array $meta = null, int $sortOrder = 0): void
    {
        self::updateOrCreate(
            ['page' => $page, 'section' => $section, 'key' => $key],
            ['value' => $value, 'meta' => $meta, 'sort_order' => $sortOrder, 'is_active' => true]
        );
    }

    /**
     * Save an array section (features, testimonials, etc.)
     */
    private static function saveArraySection(string $page, string $section, array $items): void
    {
        // Delete existing items for this section
        self::where('page', $page)
            ->where('section', $section)
            ->where('key', 'like', 'item%')
            ->delete();

        // Insert new items
        foreach ($items as $index => $item) {
            $value = $item['title'] ?? $item['name'] ?? $item['value'] ?? '';
            $meta = $item;
            unset($meta['value']); // Don't duplicate value in meta
            
            self::create([
                'page' => $page,
                'section' => $section,
                'key' => "item{$index}",
                'value' => $value,
                'meta' => $meta,
                'sort_order' => $index,
                'is_active' => true,
            ]);
        }
    }

    /**
     * Delete section items matching a pattern
     */
    private static function deleteSection(string $page, string $section, string $keyPattern): void
    {
        self::where('page', $page)
            ->where('section', $section)
            ->where('key', 'like', $keyPattern)
            ->delete();
    }

    /**
     * Get structured content for Legal page (Terms & Privacy)
     */
    public static function getLegalContent(): array
    {
        $raw = self::getPageContent('legal');

        return [
            'termsLastUpdated' => $raw['terms']['lastUpdated'] ?? now()->format('F j, Y'),
            'termsIntro' => $raw['terms']['intro'] ?? '',
            'termsSections' => self::extractArrayItemsWithMeta($raw, 'termsSections'),
            'privacyLastUpdated' => $raw['privacy']['lastUpdated'] ?? now()->format('F j, Y'),
            'privacyIntro' => $raw['privacy']['intro'] ?? '',
            'privacySections' => self::extractArrayItemsWithMeta($raw, 'privacySections'),
        ];
    }

    /**
     * Save Legal page content (Terms & Privacy)
     */
    public static function saveLegalContent(array $data): void
    {
        // Save terms metadata
        self::upsertContent('legal', 'terms', 'lastUpdated', $data['termsLastUpdated'] ?? now()->format('F j, Y'));
        self::upsertContent('legal', 'terms', 'intro', $data['termsIntro'] ?? '');

        // Save terms sections
        self::saveArraySection('legal', 'termsSections', $data['termsSections'] ?? []);

        // Save privacy metadata
        self::upsertContent('legal', 'privacy', 'lastUpdated', $data['privacyLastUpdated'] ?? now()->format('F j, Y'));
        self::upsertContent('legal', 'privacy', 'intro', $data['privacyIntro'] ?? '');

        // Save privacy sections
        self::saveArraySection('legal', 'privacySections', $data['privacySections'] ?? []);
    }

    /**
     * Get structured content for Products page
     */
    public static function getProductsContent(): array
    {
        $raw = self::getPageContent('products');
        
        return [
            'heroTag' => $raw['hero']['tag'] ?? 'Our Products',
            'heroTitle' => $raw['hero']['title'] ?? 'Premium Rice Selection',
            'heroSubtitle' => $raw['hero']['subtitle'] ?? 'Discover our wide range of quality rice products, from premium jasmine to nutritious brown rice',
            'heroImage' => $raw['hero']['image'] ?? null,
            'badges' => self::extractArrayItemsWithMeta($raw, 'badges'),
            'ctaTitle' => $raw['cta']['title'] ?? 'Need Bulk Orders or Custom Packaging?',
            'ctaDescription' => $raw['cta']['description'] ?? 'Contact us for wholesale pricing, bulk orders, or custom packaging solutions for your business.',
            'ctaButtonText' => $raw['cta']['buttonText'] ?? 'Contact for Wholesale',
        ];
    }

    /**
     * Get structured content for Contact page
     */
    public static function getContactContent(): array
    {
        $raw = self::getPageContent('contact');
        
        return [
            'heroTag' => $raw['hero']['tag'] ?? 'Get In Touch',
            'heroTitle' => $raw['hero']['title'] ?? 'Contact Us',
            'heroSubtitle' => $raw['hero']['subtitle'] ?? "Have questions or ready to place an order? We'd love to hear from you!",
            'heroImage' => $raw['hero']['image'] ?? null,
            'formTitle' => $raw['form']['title'] ?? 'Send Us a Message',
            'faqs' => self::extractArrayItemsWithMeta($raw, 'faqs'),
            'socialTitle' => $raw['social']['title'] ?? 'Connect With Us',
            'socialDescription' => $raw['social']['description'] ?? 'Follow us on social media for updates and promotions',
        ];
    }

    /**
     * Save Products page content
     */
    public static function saveProductsContent(array $data): void
    {
        // Save hero section
        self::upsertContent('products', 'hero', 'tag', $data['heroTag'] ?? '');
        self::upsertContent('products', 'hero', 'title', $data['heroTitle'] ?? '');
        self::upsertContent('products', 'hero', 'subtitle', $data['heroSubtitle'] ?? '');
        if (isset($data['heroImage'])) {
            self::upsertContent('products', 'hero', 'image', $data['heroImage']);
        }

        // Save badges
        self::saveArraySection('products', 'badges', $data['badges'] ?? []);

        // Save CTA section
        self::upsertContent('products', 'cta', 'title', $data['ctaTitle'] ?? '');
        self::upsertContent('products', 'cta', 'description', $data['ctaDescription'] ?? '');
        self::upsertContent('products', 'cta', 'buttonText', $data['ctaButtonText'] ?? '');
    }

    /**
     * Save Contact page content
     */
    public static function saveContactContent(array $data): void
    {
        // Save hero section
        self::upsertContent('contact', 'hero', 'tag', $data['heroTag'] ?? '');
        self::upsertContent('contact', 'hero', 'title', $data['heroTitle'] ?? '');
        self::upsertContent('contact', 'hero', 'subtitle', $data['heroSubtitle'] ?? '');
        if (isset($data['heroImage'])) {
            self::upsertContent('contact', 'hero', 'image', $data['heroImage']);
        }

        // Save form section
        self::upsertContent('contact', 'form', 'title', $data['formTitle'] ?? '');

        // Save FAQs
        self::saveArraySection('contact', 'faqs', $data['faqs'] ?? []);

        // Save social section
        self::upsertContent('contact', 'social', 'title', $data['socialTitle'] ?? '');
        self::upsertContent('contact', 'social', 'description', $data['socialDescription'] ?? '');
    }

    /**
     * Seed default content
     */
    public static function seedDefaults(): void
    {
        $startYear = BusinessSetting::where('key', 'business_start_year')->value('value') ?? '2010';
        $yearsInBusiness = now()->year - (int) $startYear;

        // Default Home content
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
                ['value' => '15+', 'label' => 'Years Experience'],
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

        // Default About content
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
                ['year' => '2010', 'title' => 'Foundation', 'description' => 'KJP Ricemill was established with a small milling facility and a vision for quality.'],
                ['year' => '2014', 'title' => 'Expansion', 'description' => 'Expanded operations with modern milling equipment and increased storage capacity.'],
                ['year' => '2018', 'title' => 'Growth', 'description' => 'Reached 100+ regular customers and established partnerships with local farmers.'],
                ['year' => '2022', 'title' => 'Innovation', 'description' => 'Implemented digital inventory system and launched online ordering platform.'],
                ['year' => '2024', 'title' => 'Present', 'description' => 'Serving 500+ customers with a diverse range of premium rice products.'],
            ],
            'team' => [
                ['name' => 'Jose P. Katipunan', 'role' => 'Founder & CEO'],
                ['name' => 'Maria Santos', 'role' => 'Operations Manager'],
                ['name' => 'Pedro Garcia', 'role' => 'Quality Control Head'],
                ['name' => 'Ana Reyes', 'role' => 'Sales Manager'],
            ],
        ];

        self::saveHomeContent($homeDefaults);
        self::saveAboutContent($aboutDefaults);

        // Default Products content
        $productsDefaults = [
            'heroTag' => 'Our Products',
            'heroTitle' => 'Premium Rice Selection',
            'heroSubtitle' => 'Discover our wide range of quality rice products, from premium jasmine to nutritious brown rice',
            'badges' => [
                ['title' => 'Fresh from Farm', 'icon' => 'Leaf'],
                ['title' => 'Quality Guaranteed', 'icon' => 'Award'],
                ['title' => 'Fast Delivery', 'icon' => 'Truck'],
            ],
            'ctaTitle' => 'Need Bulk Orders or Custom Packaging?',
            'ctaDescription' => 'Contact us for wholesale pricing, bulk orders, or custom packaging solutions for your business.',
            'ctaButtonText' => 'Contact for Wholesale',
        ];

        // Default Contact content
        $contactDefaults = [
            'heroTag' => 'Get In Touch',
            'heroTitle' => 'Contact Us',
            'heroSubtitle' => "Have questions or ready to place an order? We'd love to hear from you!",
            'formTitle' => 'Send Us a Message',
            'faqs' => [
                ['question' => 'What is the minimum order for delivery?', 'answer' => 'For deliveries within Rosario, we require a minimum of 2 sacks (50kg). For bulk orders outside Rosario, please contact us for arrangements.'],
                ['question' => 'Do you offer wholesale pricing?', 'answer' => 'Yes! We offer competitive wholesale prices for businesses, restaurants, and resellers. Contact us for our wholesale price list.'],
                ['question' => 'What payment methods do you accept?', 'answer' => 'We accept cash, bank transfer, GCash, Maya, and credit/debit cards for in-store purchases.'],
            ],
            'socialTitle' => 'Connect With Us',
            'socialDescription' => 'Follow us on social media for updates and promotions',
        ];

        self::saveProductsContent($productsDefaults);
        self::saveContactContent($contactDefaults);

        // Default Legal content (Terms & Conditions + Privacy Policy)
        $legalDefaults = [
            'termsLastUpdated' => 'January 1, 2026',
            'termsIntro' => 'By using KJP Ricemill services, you agree to the following terms and conditions. Please read them carefully.',
            'termsSections' => [
                ['title' => 'Account Registration', 'content' => 'By creating an account, you agree to provide accurate and complete information. You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately of any unauthorized access to your account.'],
                ['title' => 'Use of Services', 'content' => 'Our system is designed to facilitate rice product purchasing, order management, and delivery services. You agree to use our services only for lawful purposes and in accordance with these terms. Misuse of the system may result in account suspension or termination.'],
                ['title' => 'Orders and Payments', 'content' => 'All orders placed through the system are subject to availability and confirmation. Prices are subject to change without prior notice. Payment must be made in full according to the selected payment method. Unpaid orders may be cancelled after the agreed payment period.'],
                ['title' => 'Delivery', 'content' => 'Delivery schedules are estimated and may vary depending on location and availability. KJP Ricemill will make reasonable efforts to deliver on time. The customer is responsible for providing accurate delivery addresses and being available to receive deliveries.'],
                ['title' => 'Product Quality', 'content' => 'KJP Ricemill is committed to delivering premium quality rice products. If you receive a product that does not meet our quality standards, please contact us within 24 hours of delivery for resolution.'],
                ['title' => 'Cancellations and Returns', 'content' => 'Orders may be cancelled before processing. Once an order has been processed or dispatched, cancellation is subject to approval. Returns are accepted only for defective or incorrect items within the specified return period.'],
                ['title' => 'Limitation of Liability', 'content' => 'KJP Ricemill shall not be liable for any indirect, incidental, or consequential damages arising from the use of our services. Our total liability shall not exceed the amount paid for the specific order in question.'],
                ['title' => 'Modifications', 'content' => 'We reserve the right to modify these terms at any time. Continued use of the system after changes constitutes acceptance of the updated terms. Users will be notified of significant changes via email or system notification.'],
                ['title' => 'Contact Information', 'content' => 'For questions or concerns regarding these terms, please contact us through our website contact page or email us directly. Our team is committed to addressing your inquiries promptly.'],
            ],
            'privacyLastUpdated' => 'January 1, 2026',
            'privacyIntro' => 'KJP Ricemill is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal information in compliance with the Data Privacy Act of 2012 (Republic Act No. 10173).',
            'privacySections' => [
                ['title' => 'Information We Collect', 'content' => 'We collect personal information that you provide when creating an account or placing orders, including your name, email address, phone number, and delivery address. We may also collect order history and payment information to process your transactions.'],
                ['title' => 'How We Use Your Information', 'content' => 'Your personal information is used to process orders, arrange deliveries, send order updates and notifications, improve our services, and communicate important changes. We may also use aggregated, non-identifiable data for analytics purposes.'],
                ['title' => 'Data Protection and Security', 'content' => 'We implement appropriate technical and organizational security measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. Your account is protected by password authentication and we use secure connections for data transmission.'],
                ['title' => 'Data Sharing', 'content' => 'Your personal information will not be sold, traded, or shared with unauthorized third parties. We may share necessary information with delivery personnel to fulfill orders and with payment processors to complete transactions.'],
                ['title' => 'Data Retention', 'content' => 'We retain your personal information for as long as your account is active or as needed to provide services. You may request deletion of your data by contacting our team, subject to any legal obligations that require us to retain certain information.'],
                ['title' => 'Your Rights', 'content' => 'Under the Data Privacy Act of 2012, you have the right to access, correct, and request deletion of your personal data. You may also object to or restrict certain processing activities. To exercise these rights, please contact our team.'],
                ['title' => 'Cookies and Tracking', 'content' => 'Our system may use cookies and similar technologies to enhance your experience, remember your preferences, and maintain your session. You can manage cookie settings through your browser preferences.'],
                ['title' => 'Changes to This Policy', 'content' => 'We may update this privacy policy from time to time. Any changes will be posted on our platform and, where appropriate, notified to you via email. Continued use of our services after changes constitutes acceptance of the updated policy.'],
            ],
        ];

        self::saveLegalContent($legalDefaults);
    }
}
