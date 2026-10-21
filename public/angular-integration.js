/**
 * Domestic Services - Global Angular Integration & Polished UI Effects
 * Applies AngularJS bindings, reactive model helpers, button micro-interactions,
 * and component glow/elevation effects across all project pages.
 */

(function () {
    'use strict';

    // 1. Inject AngularJS CDN dynamically if not already in document
    if (!window.angular) {
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/angular.js/1.8.3/angular.min.js';
        script.onload = initializeAngularApp;
        document.head.appendChild(script);
    } else {
        initializeAngularApp();
    }

    function initializeAngularApp() {
        if (!window.angular) return;

        // Create or get global Angular module
        var app;
        try {
            app = angular.module('domesticServicesApp');
        } catch (e) {
            app = angular.module('domesticServicesApp', []);
        }

        // Global Controller providing reactive helpers & attractive animation triggers
        app.controller('GlobalPageController', ['$scope', function ($scope) {
            $scope.activeTab = 'dashboard';
            $scope.isProcessing = false;
            $scope.searchFilter = '';

            $scope.setTab = function (tab) {
                $scope.activeTab = tab;
            };

            $scope.triggerPulse = function (event) {
                var btn = event.currentTarget;
                if (!btn) return;
                btn.classList.add('ng-btn-clicked');
                setTimeout(function () {
                    btn.classList.remove('ng-btn-clicked');
                }, 350);
            };
        }]);

        // Auto-bootstrap angular on body if not already bootstrapped
        document.addEventListener('DOMContentLoaded', function () {
            if (!document.body.getAttribute('ng-app')) {
                document.body.setAttribute('ng-app', 'domesticServicesApp');
                document.body.setAttribute('ng-controller', 'GlobalPageController');
                try {
                    angular.bootstrap(document.body, ['domesticServicesApp']);
                } catch (err) {
                    // Already bootstrapped
                }
            }
        });
    }

    // 2. Add Attractive UI Styling for all components & buttons
    var style = document.createElement('style');
    style.id = 'ng-attractive-theme';
    style.innerHTML = `
        /* ====== ATTRACTIVE MODERN COMPONENT ENHANCEMENTS ====== */

        /* Universal Button Polish */
        button, .card-action-btn, .side-item, .login-btn, .register-btn, .confirm-quote-btn,
        .c-action-btn, .btn-primary, .btn-success, .btn-warning, .btn-danger,
        .chat-action-btn, .submit-request-btn, .primary-btn, .favorite-btn,
        .chip-btn, .chat-send-btn, .chat-shortcut-btn, .logout-btn {
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.07), 0 1px 2px -1px rgba(0, 0, 0, 0.07) !important;
            position: relative;
            overflow: hidden;
            cursor: pointer;
            font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif;
        }

        button:hover, .side-item:hover, .card-action-btn:hover, .c-action-btn:hover,
        .login-btn:hover, .register-btn:hover, .chat-action-btn:hover,
        .submit-request-btn:hover, .primary-btn:hover, .favorite-btn:hover,
        .chip-btn:hover, .logout-btn:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 8px 25px -5px rgba(37, 99, 235, 0.25), 0 4px 10px -5px rgba(37, 99, 235, 0.1) !important;
            filter: brightness(1.05);
        }

        button:active, .side-item:active, .card-action-btn:active,
        .submit-request-btn:active, .primary-btn:active {
            transform: translateY(0.5px) scale(0.97) !important;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1) !important;
        }

        /* Ripple Click Effect */
        .ng-btn-clicked::after {
            content: "";
            position: absolute;
            top: 50%;
            left: 50%;
            width: 180%;
            height: 180%;
            background: radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 70%);
            border-radius: 50%;
            transform: translate(-50%, -50%) scale(0);
            animation: ngRipple 0.5s ease-out;
        }

        @keyframes ngRipple {
            to { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }

        /* Sidebar Buttons - Active Indicator */
        .side-item.active, aside button.active {
            position: relative;
            font-weight: 700 !important;
        }

        .side-item.active::before, aside button.active::before {
            content: '';
            position: absolute;
            left: 0;
            top: 15%;
            height: 70%;
            width: 4px;
            border-radius: 0 4px 4px 0;
            background: linear-gradient(180deg, #3b82f6, #8b5cf6);
        }

        /* Attractive Card Elevations */
        .company-card, .tracking-card, .worker-card, .job-card, .stat-card,
        .login-box, .register-box, .company-request-card, .benefit {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            border-radius: 14px !important;
        }

        .company-card:hover, .tracking-card:hover, .worker-card:hover,
        .job-card:hover, .company-request-card:hover {
            box-shadow: 0 12px 35px -8px rgba(15, 23, 42, 0.12),
                        0 6px 12px -6px rgba(15, 23, 42, 0.06) !important;
            border-color: #93c5fd !important;
            transform: translateY(-2px);
        }

        /* Stat Cards Gradient Borders */
        .stat-card:hover {
            border-image: linear-gradient(135deg, #3b82f6, #8b5cf6) 1 !important;
        }

        /* Inputs & Dropdowns Polish */
        input, select, textarea {
            transition: all 0.25s ease !important;
            font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif !important;
        }

        input:focus, select:focus, textarea:focus {
            outline: none !important;
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12) !important;
            background: #fff !important;
        }

        /* Badge Pill Animations */
        .sidebar-pill, .fab-badge, .verified-badge {
            animation: badgePulse 2s ease-in-out infinite;
        }

        @keyframes badgePulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
        }

        /* Back Arrow - Universal */
        .ds-back-arrow {
            position: fixed;
            top: 18px;
            left: 18px;
            width: 42px;
            height: 42px;
            border-radius: 12px;
            background: linear-gradient(135deg, #1e293b, #334155) !important;
            color: white !important;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 9999;
            text-decoration: none;
            border: none;
            box-shadow: 0 4px 15px rgba(15, 23, 42, 0.3) !important;
        }

        .ds-back-arrow:hover {
            transform: translateX(-3px) translateY(-1px) !important;
            box-shadow: 0 6px 20px rgba(15, 23, 42, 0.4) !important;
            background: linear-gradient(135deg, #334155, #475569) !important;
        }

        /* Smooth Modal Entrance */
        .modal-content {
            animation: modalSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes modalSlideIn {
            from { opacity: 0; transform: scale(0.92) translateY(15px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* Tooltip Hover Text */
        [title]:hover {
            cursor: help;
        }

        /* Scrollbar Styling */
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        ::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
            background: #94a3b8;
            border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: #64748b;
        }

        /* Profile Section Styles */
        .profile-section {
            background: linear-gradient(135deg, #f8fafc, #f1f5f9);
            border-radius: 16px;
            padding: 30px;
            border: 1px solid #e2e8f0;
        }

        .profile-header {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 24px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e2e8f0;
        }

        .profile-avatar-large {
            width: 80px;
            height: 80px;
            border-radius: 20px;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            font-weight: 800;
            box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
        }

        .profile-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 16px;
        }

        .profile-field label {
            font-size: 12px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }

        .profile-field-value {
            font-size: 15px;
            color: #0f172a;
            font-weight: 500;
            padding: 10px 14px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
        }

        .profile-field input {
            padding: 10px 14px;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            font-size: 14px;
        }

        .profile-save-btn {
            background: linear-gradient(135deg, #059669, #10b981) !important;
            color: white !important;
            padding: 12px 28px !important;
            border-radius: 12px !important;
            font-weight: 700 !important;
            font-size: 14px !important;
            border: none !important;
            letter-spacing: 0.5px;
        }

        .profile-save-btn:hover {
            box-shadow: 0 8px 25px rgba(5, 150, 105, 0.3) !important;
        }
    `;
    document.head.appendChild(style);
})();
